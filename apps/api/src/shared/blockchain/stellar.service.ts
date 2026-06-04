import { createHmac } from 'crypto';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Asset,
  Contract,
  FeeBumpTransaction,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import type {
  BlockchainService,
  ChargeInvestorInput,
  PayPmeInput,
  TokenizeNfeInput,
  TransferNftToInvestorInput,
} from './blockchain.interface';

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

// Fee para operações Soroban — simulação retorna o mínimo necessário, mas um
// valor generoso aqui evita rejeições por fee insuficiente antes da simulação.
const SOROBAN_FEE = '100000'; // 0.01 XLM

// Fee para operações clássicas Horizon (payment, changeTrust, createAccount).
// 1 000 stroops = 0.0001 XLM — muito acima do mínimo (100 stroops) e suficiente
// para prioridade mesmo em períodos de carga elevada na rede.
const CLASSIC_FEE = '1000';

const TESOURO_ISSUER =
  'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4';
const TESOURO = new Asset('TESOURO', TESOURO_ISSUER);
const TX_TIMEOUT_SECONDS = 30;
const POLL_INTERVAL_MS = 2000;
const POLL_DEADLINE_MS = 60_000;

@Injectable()
export class StellarService implements BlockchainService {
  private readonly logger = new Logger(StellarService.name);

  // RPC é usado para chamadas Soroban; Horizon é usado para contas,
  // payments clássicos, trustlines e submit de transações Stellar comuns.
  private readonly server: rpc.Server | undefined;
  private readonly horizon: Horizon.Server;

  // platformKeypair representa a conta operacional da CredBridge.
  // Tudo que for patrocínio, fee bump ou autorização da plataforma tende
  // a passar por esta keypair.
  private readonly platformKeypair: Keypair | undefined;
  private readonly contractId: string | undefined;

  // walletSecret deriva carteiras custodiais de forma determinística por usuário.
  // Quem usa Privy não tem keypair local e precisa assinar fora deste serviço.
  private readonly walletSecret: string;
  private readonly isMainnet: boolean;

  constructor(private readonly prisma: PrismaService) {
    const rpcUrl = process.env.STELLAR_RPC_URL;
    const secretKey = process.env.STELLAR_SECRET_KEY;
    const contractId = process.env.STELLAR_CONTRACT_ID;
    this.isMainnet = process.env.STELLAR_NETWORK === 'mainnet';
    const horizonUrl = this.isMainnet
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';

    this.walletSecret = process.env.STELLAR_WALLET_SECRET ?? '';
    this.horizon = new Horizon.Server(horizonUrl);

    // Sem estas variáveis, o serviço ainda instancia, mas bloqueia operações
    // on-chain reais via requireContractConfig().
    if (rpcUrl && secretKey && contractId) {
      this.server = new rpc.Server(rpcUrl, { allowHttp: true });
      this.platformKeypair = Keypair.fromSecret(secretKey);
      this.contractId = contractId;
    } else {
      this.logger.warn(
        'Stellar contract env vars missing (STELLAR_RPC_URL, STELLAR_SECRET_KEY, STELLAR_CONTRACT_ID) — tokenization disabled',
      );
    }
  }

  async registerProof(hash: string): Promise<string> {
    this.logger.log(`registerProof: ${hash} (not yet implemented)`);
    return `stellar-proof-${Date.now()}`;
  }

  async tokenizeNfe(data: TokenizeNfeInput): Promise<string> {
    // Fluxo principal de tokenização:
    // 1. localiza a carteira Stellar da PME;
    // 2. chama o contrato para criar o registro da NF-e;
    // 3. transfere a propriedade para a plataforma.
    this.logger.log(
      `tokenizeNfe — key: ${data.key}, value: ${data.value}, owner: ${data.ownerUserId}`,
    );

    const { server, platformKeypair, contractId } =
      this.requireContractConfig();

    // Look up PME's Privy wallet, with legacy wallet fallback.
    const user = await this.prisma.user.findUnique({
      where: { id: data.ownerUserId },
      select: { stellarWalletId: true, privyStellarWalletAddress: true },
    });
    const pmeAddress =
      user?.privyStellarWalletAddress ?? user?.stellarWalletId ?? null;
    if (!pmeAddress) {
      throw new ConflictException(
        `PME ${data.ownerUserId} has no Stellar wallet — cannot tokenize`,
      );
    }

    const xmlHashBytes = this.toBytes32(data.xmlHash);
    const valueInCentavos = BigInt(Math.round(data.value * 100));
    const dueDateUnix = BigInt(Math.floor(data.dueDate.getTime() / 1000));
    const platformAddress = platformKeypair.publicKey();

    // Step 1: tokenize with PME as owner, platform authorizes.
    // A plataforma assina porque o contrato espera esta autorização.
    this.logger.log(`Tokenizing NF ${data.key} — owner: ${pmeAddress}`);
    const mintHash = await this.invokeContract(
      server,
      platformKeypair,
      contractId,
      'tokenize_nfe',
      [
        nativeToScVal(data.key, { type: 'string' }),
        nativeToScVal(valueInCentavos, { type: 'i128' }),
        nativeToScVal(dueDateUnix, { type: 'u64' }),
        xdr.ScVal.scvBytes(xmlHashBytes),
        nativeToScVal(pmeAddress, { type: 'address' }),
        nativeToScVal(platformAddress, { type: 'address' }),
      ],
    );
    this.logger.log(`NF tokenized — txHash: ${mintHash}`);

    // Step 2: transfer ownership to platform (CredBridge receives the receivable).
    // Depois disso, a plataforma consegue vender/transferir o recebível.
    this.logger.log(
      `Transferring NF ${data.key} ownership to platform: ${platformAddress}`,
    );
    const transferHash = await this.invokeContract(
      server,
      platformKeypair,
      contractId,
      'transfer_ownership',
      [
        nativeToScVal(data.key, { type: 'string' }),
        nativeToScVal(platformAddress, { type: 'address' }),
        nativeToScVal(platformAddress, { type: 'address' }),
      ],
    );
    this.logger.log(`Ownership transferred — txHash: ${transferHash}`);

    return mintHash;
  }

  async payPme(data: PayPmeInput): Promise<string> {
    // Pagamento clássico via Horizon: plataforma envia TESOURO para a PME.
    // A plataforma é a source e tem XLM para pagar a fee — sem Fee Bump necessário.
    const { platformKeypair } = this.requireContractConfig();

    const { publicKey: pmeAddress } = await this.ensureCustodialWalletForUser(
      data.pmeUserId,
    );

    const amount = data.amountBrl.toFixed(7);
    this.logger.log(
      `payPme — ${amount} TESOURO to ${pmeAddress} memo=${data.memo}`,
    );

    const sourceAccount = await this.horizon.loadAccount(
      platformKeypair.publicKey(),
    );

    const tx = new TransactionBuilder(sourceAccount, {
      fee: CLASSIC_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: pmeAddress,
          asset: TESOURO,
          amount,
        }),
      )
      .addMemo(Memo.text(data.memo.slice(0, 28)))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    tx.sign(platformKeypair);
    const res = await this.submitWithDetail(tx, 'payPme');
    this.logger.log(`payPme confirmed — txHash: ${res.hash}`);
    return res.hash;
  }

  async transferNftToInvestor(
    data: TransferNftToInvestorInput,
  ): Promise<string> {
    // Transferência Soroban do NFT/recebível para o investidor.
    // A propriedade sai da plataforma e passa para a carteira do investidor.
    const { server, platformKeypair, contractId } =
      this.requireContractConfig();

    const { publicKey: investorAddress } =
      await this.ensureCustodialWalletForUser(data.investorUserId);

    const platformAddress = platformKeypair.publicKey();
    this.logger.log(
      `Transferring NF ${data.receivableKey} from platform → investor ${investorAddress}`,
    );

    const txHash = await this.invokeContract(
      server,
      platformKeypair,
      contractId,
      'transfer_ownership',
      [
        nativeToScVal(data.receivableKey, { type: 'string' }),
        nativeToScVal(investorAddress, { type: 'address' }),
        nativeToScVal(platformAddress, { type: 'address' }),
      ],
    );
    this.logger.log(`NF transferred to investor — txHash: ${txHash}`);
    return txHash;
  }

  async chargeInvestor(data: ChargeInvestorInput): Promise<string> {
    // Cobra o investidor: carteira custodial do investidor envia TESOURO para
    // a plataforma. Como a carteira é patrocinada e não tem XLM próprio para
    // fees, a plataforma cobre via Fee Bump.
    //
    // Carteiras Privy não possuem keypair neste backend e não podem assinar
    // este payment diretamente — o chamador deve tratar esse caso via Privy.
    const { platformKeypair } = this.requireContractConfig();

    const { publicKey: investorAddress, keypair: investorKeypair } =
      await this.ensureCustodialWalletForUser(data.investorUserId);

    if (!investorKeypair) {
      throw new Error(
        `Investor ${data.investorUserId} uses a Privy wallet — payment must be signed by Privy`,
      );
    }

    const platformAddress = platformKeypair.publicKey();
    const amount = data.amountBrl.toFixed(7);
    this.logger.log(
      `chargeInvestor — ${amount} TESOURO from ${investorAddress} → platform memo=${data.memo}`,
    );

    // Inner tx: investidor é o source e assina o envio de TESOURO.
    // A fee declarada aqui é sobreposta pelo Fee Bump; o valor não importa
    // para o custo real, mas precisa ser um número válido.
    const investorAccount = await this.horizon.loadAccount(investorAddress);

    const innerTx = new TransactionBuilder(investorAccount, {
      fee: CLASSIC_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: platformAddress,
          asset: TESOURO,
          amount,
        }),
      )
      .addMemo(Memo.text(data.memo.slice(0, 28)))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    innerTx.sign(investorKeypair);

    // Fee Bump: plataforma paga a fee em XLM pelo investidor.
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      platformKeypair,
      CLASSIC_FEE,
      innerTx,
      NETWORK_PASSPHRASE,
    );
    feeBumpTx.sign(platformKeypair);

    const res = await this.submitWithDetail(feeBumpTx, 'chargeInvestor');
    this.logger.log(`chargeInvestor confirmed — txHash: ${res.hash}`);
    return res.hash;
  }

  private async submitWithDetail(
    tx: Transaction | FeeBumpTransaction,
    label: string,
  ): Promise<{ hash: string }> {
    // Centraliza submit via Horizon e preserva detalhes úteis de erro.
    // Aceita tanto transações clássicas quanto Fee Bump.
    try {
      return await this.horizon.submitTransaction(tx);
    } catch (err: unknown) {
      const e = err as {
        response?: {
          data?: {
            extras?: { result_codes?: unknown; result_xdr?: string };
            detail?: string;
          };
        };
        message?: string;
      };
      const extras = e?.response?.data?.extras;
      const detail = e?.response?.data?.detail;
      const codes = extras?.result_codes
        ? JSON.stringify(extras.result_codes)
        : 'n/a';
      const resultXdr = extras?.result_xdr ?? 'n/a';
      this.logger.error(
        `Horizon submit failed [${label}] — detail=${detail ?? 'n/a'} codes=${codes} result_xdr=${resultXdr}`,
      );
      throw new Error(
        `Horizon ${label} failed: ${detail ?? e?.message ?? 'unknown'} (codes=${codes})`,
      );
    }
  }

  async settlePayment(data: {
    receivableId: string;
    amount: number;
    destination: string;
  }): Promise<string> {
    this.logger.log(
      `settlePayment: receivable ${data.receivableId} (not yet implemented)`,
    );
    return `stellar-settle-${Date.now()}`;
  }

  async getTransactionStatus(
    txHash: string,
  ): Promise<'pending' | 'success' | 'failed'> {
    const { server } = this.requireContractConfig();
    const result = await server.getTransaction(txHash);
    if (result.status === 'SUCCESS') return 'success';
    if (result.status === 'FAILED') return 'failed';
    return 'pending';
  }

  async createCustodialWallet(googleId: string): Promise<string> {
    // Cria ou encontra a carteira custodial derivada do Google ID.
    // Testnet usa Friendbot; mainnet usa sponsorship da plataforma.
    if (!this.walletSecret) {
      throw new Error('STELLAR_WALLET_SECRET not configured');
    }

    const keypair = this.deriveKeypair(googleId);
    const publicKey = keypair.publicKey();
    const { platformKeypair } = this.requireContractConfig();

    const accountExists = await this.horizon
      .loadAccount(publicKey)
      .then(() => true)
      .catch(() => false);

    if (accountExists) {
      this.logger.log(`Custodial wallet already exists: ${publicKey}`);
      return publicKey;
    }

    if (!this.isMainnet) {
      // ── TESTNET: usa Friendbot ──────────────────────────────────────────
      this.logger.log(`Funding new testnet wallet via Friendbot: ${publicKey}`);
      const res = await fetch(
        `https://friendbot.stellar.org?addr=${publicKey}`,
      );
      if (!res.ok) {
        throw new Error(`Friendbot failed (${res.status}) for ${publicKey}`);
      }
      await this.establishTesourTrustline(keypair);
    } else {
      // ── MAINNET: plataforma patrocina criação + trustline ───────────────
      this.logger.log(`Creating sponsored mainnet wallet: ${publicKey}`);
      await this.createSponsoredAccount(platformKeypair, keypair);
    }

    return publicKey;
  }

  private async createSponsoredAccount(
    sponsorKeypair: Keypair,
    newKeypair: Keypair,
  ): Promise<void> {
    // Sponsoring permanente: a plataforma assume as reservas mínimas da conta
    // e da trustline TESOURO. A nova conta fica utilizável sem precisar de
    // XLM próprio para reserva inicial ou fees.
    //
    // Operações e assinantes:
    //   beginSponsoringFutureReserves → sponsor assina (source implícita)
    //   createAccount                 → sponsor assina (source implícita)
    //   changeTrust                   → nova conta assina (source explícita)
    //   endSponsoringFutureReserves   → nova conta assina (source explícita)
    const sponsorAccount = await this.horizon.loadAccount(
      sponsorKeypair.publicKey(),
    );

    const tx = new TransactionBuilder(sponsorAccount, {
      fee: CLASSIC_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.beginSponsoringFutureReserves({
          sponsoredId: newKeypair.publicKey(),
        }),
      )
      .addOperation(
        Operation.createAccount({
          destination: newKeypair.publicKey(),
          // Zero é válido porque o base reserve é coberto pelo sponsor ativo.
          startingBalance: '0',
        }),
      )
      .addOperation(
        Operation.changeTrust({
          asset: TESOURO,
          source: newKeypair.publicKey(),
        }),
      )
      .addOperation(
        Operation.endSponsoringFutureReserves({
          source: newKeypair.publicKey(),
        }),
      )
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    tx.sign(sponsorKeypair, newKeypair);

    await this.submitWithDetail(tx, 'createSponsoredAccount');
    this.logger.log(`Sponsored account created: ${newKeypair.publicKey()}`);
  }

  private async invokeContract(
    server: rpc.Server,
    signerKeypair: Keypair,
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<string> {
    // Caminho único para chamadas Soroban:
    // monta a tx, simula para calcular recursos, monta a tx final,
    // assina, envia via RPC e espera confirmação.
    const contract = new Contract(contractId);
    const sourceAccount = await this.horizon.loadAccount(
      signerKeypair.publicKey(),
    );

    const tx = new TransactionBuilder(sourceAccount, {
      fee: SOROBAN_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    const simResult = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(simResult)) {
      throw new Error(
        `Soroban simulation failed [${method}]: ${JSON.stringify(simResult)}`,
      );
    }

    const assembled = rpc.assembleTransaction(tx, simResult).build();
    assembled.sign(signerKeypair);

    const sendResult = await server.sendTransaction(assembled);
    if (sendResult.status === 'ERROR') {
      throw new Error(
        `Stellar RPC rejected tx [${method}]: ${JSON.stringify(sendResult.errorResult)}`,
      );
    }

    await this.waitForConfirmation(sendResult.hash, server);
    return sendResult.hash;
  }

  private async establishTesourTrustline(keypair: Keypair): Promise<void> {
    // Trustline é obrigatória para receber TESOURO.
    // Chamada apenas em testnet pós-Friendbot, onde a conta tem XLM próprio.
    // Em mainnet patrocinada, a trustline já é criada em createSponsoredAccount().
    const publicKey = keypair.publicKey();
    try {
      const account = await this.horizon.loadAccount(publicKey);
      const tx = new TransactionBuilder(account, {
        fee: CLASSIC_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(Operation.changeTrust({ asset: TESOURO }))
        .setTimeout(TX_TIMEOUT_SECONDS)
        .build();
      tx.sign(keypair);
      await this.submitWithDetail(tx, 'changeTrust:TESOURO');
      this.logger.log(`TESOURO trustline established for ${publicKey}`);
    } catch (err) {
      this.logger.warn(
        `Failed to establish TESOURO trustline for ${publicKey}: ${(err as Error).message}`,
      );
    }
  }

  private deriveKeypair(seedSource: string): Keypair {
    // Derivação determinística: o mesmo usuário gera sempre a mesma carteira.
    // A segurança depende diretamente do STELLAR_WALLET_SECRET.
    const seed = createHmac('sha256', this.walletSecret)
      .update(seedSource)
      .digest();
    return Keypair.fromRawEd25519Seed(seed);
  }

  private async ensureCustodialWalletForUser(
    userId: string,
  ): Promise<{ publicKey: string; keypair: Keypair | null }> {
    // Garante uma carteira utilizável para fluxos internos.
    // Retorna keypair apenas quando a carteira é custodial; para Privy,
    // retorna somente o endereço público (keypair: null).
    if (!this.walletSecret) {
      throw new Error('STELLAR_WALLET_SECRET not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        googleId: true,
        stellarWalletId: true,
        privyStellarWalletAddress: true,
      },
    });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Carteira externa (Privy) — não custodial, sem keypair local.
    if (user.privyStellarWalletAddress) {
      return { publicKey: user.privyStellarWalletAddress, keypair: null };
    }

    const seedSource = user.googleId ?? user.id;
    const keypair = this.deriveKeypair(seedSource);
    const publicKey = keypair.publicKey();

    // Sanity check: chave derivada deve bater com o que está no banco.
    if (user.stellarWalletId && user.stellarWalletId !== publicKey) {
      throw new Error(
        `Wallet mismatch for user ${userId} — stored ${user.stellarWalletId} vs derived ${publicKey}`,
      );
    }

    const accountExists = await this.horizon
      .loadAccount(publicKey)
      .then(() => true)
      .catch(() => false);

    if (!accountExists) {
      if (this.isMainnet) {
        // Mainnet: plataforma patrocina criação + trustline.
        this.logger.log(
          `Creating sponsored mainnet wallet for user ${userId}: ${publicKey}`,
        );
        const { platformKeypair } = this.requireContractConfig();
        await this.createSponsoredAccount(platformKeypair, keypair);
      } else {
        // Testnet: Friendbot financia a conta com XLM de teste.
        this.logger.log(`Funding testnet wallet via Friendbot: ${publicKey}`);
        const res = await fetch(
          `https://friendbot.stellar.org?addr=${publicKey}`,
        );
        if (!res.ok) {
          throw new Error(`Friendbot failed (${res.status}) for ${publicKey}`);
        }
        await this.establishTesourTrustline(keypair);
      }
    }

    // Persiste no banco se ainda não estava salvo.
    if (!user.stellarWalletId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { stellarWalletId: publicKey },
      });
      this.logger.log(
        `Persisted custodial wallet for user ${userId}: ${publicKey}`,
      );
    }

    return { publicKey, keypair };
  }

  private requireContractConfig(): {
    server: rpc.Server;
    platformKeypair: Keypair;
    contractId: string;
  } {
    // Guard rail para impedir chamadas on-chain sem RPC, contrato ou chave
    // operacional configurados.
    if (!this.server || !this.platformKeypair || !this.contractId) {
      throw new Error(
        'Stellar contract not configured — set STELLAR_RPC_URL, STELLAR_SECRET_KEY, STELLAR_CONTRACT_ID',
      );
    }
    return {
      server: this.server,
      platformKeypair: this.platformKeypair,
      contractId: this.contractId,
    };
  }

  private async waitForConfirmation(
    hash: string,
    server?: rpc.Server,
  ): Promise<void> {
    // Soroban RPC pode retornar a hash antes da confirmação final.
    // Este polling transforma "enviado" em "confirmado ou falhou".
    const s = server ?? this.requireContractConfig().server;
    const deadline = Date.now() + POLL_DEADLINE_MS;
    while (Date.now() < deadline) {
      const result = await s.getTransaction(hash);
      if (result.status === 'SUCCESS') return;
      if (result.status === 'FAILED') {
        throw new Error(`Stellar tx failed on-chain: ${hash}`);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error(
      `Stellar tx timed out after ${POLL_DEADLINE_MS / 1000}s: ${hash}`,
    );
  }

  private toBytes32(hexHash: string | null): Buffer {
    // O contrato espera um bytes32. Quando não há hash de XML,
    // usamos zero bytes para manter o formato do argumento.
    if (!hexHash) return Buffer.alloc(32);
    const clean = hexHash.replace(/^0x/, '').padEnd(64, '0').slice(0, 64);
    return Buffer.from(clean, 'hex');
  }
}