import { createHash, createHmac } from 'crypto';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Asset,
  Contract,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import type {
  BlockchainService,
  ChargeInvestorInput,
  InvestorShares,
  PayPmeInput,
  PoolStatus,
  Scaled,
  TokenizeNfeInput,
  TransferNftToInvestorInput,
  UnsignedSorobanTx,
  WalletBalance,
} from './blockchain.interface';

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

const BASE_FEE = '1000000'; // 0.1 XLM — generous for Soroban ops
const TESOURO_ISSUER =
  'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4';
const TESOURO = new Asset('TESOURO', TESOURO_ISSUER);
const TX_TIMEOUT_SECONDS = 30;
/** Validity window for client-signed (Privy) Soroban txs — wider than TX_TIMEOUT_SECONDS because the user signs in a wallet UI between build and submit. */
const CLIENT_SIGNED_TX_TIMEOUT_SECONDS = 180;
const POLL_INTERVAL_MS = 2000;
const POLL_DEADLINE_MS = 60_000;
const MINIMUM_TESTNET_XLM_BALANCE = 1.0;

type HorizonAccountResponse = Awaited<
  ReturnType<Horizon.Server['loadAccount']>
>;

@Injectable()
export class StellarService implements BlockchainService {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: rpc.Server | undefined;
  private readonly horizon: Horizon.Server;
  private readonly platformKeypair: Keypair | undefined;
  private readonly contractId: string | undefined;
  private readonly nfeContractId: string | undefined;
  private readonly poolContractId: string | undefined;
  private readonly brltContractId: string | undefined;
  private readonly walletSecret: string;
  private readonly isMainnet: boolean;

  constructor(private readonly prisma: PrismaService) {
    const rpcUrl = process.env.STELLAR_RPC_URL;
    const secretKey = process.env.STELLAR_SECRET_KEY;
    const contractId = process.env.STELLAR_NFE_CONTRACT_ID;
    this.isMainnet = process.env.STELLAR_NETWORK === 'mainnet';
    const horizonUrl = this.isMainnet
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';

    this.walletSecret = process.env.STELLAR_WALLET_SECRET ?? '';
    this.horizon = new Horizon.Server(horizonUrl);

    this.nfeContractId = contractId;
    this.poolContractId = process.env.STELLAR_POOL_CONTRACT_ID;
    this.brltContractId = process.env.STELLAR_BRLT_TOKEN_ID;
    this.contractId = contractId;

    if (rpcUrl && secretKey && contractId) {
      this.server = new rpc.Server(rpcUrl, { allowHttp: true });
      this.platformKeypair = Keypair.fromSecret(secretKey);
    } else {
      this.logger.warn(
        'Stellar contract env vars missing (STELLAR_RPC_URL, STELLAR_SECRET_KEY, STELLAR_NFE_CONTRACT_ID) — tokenization disabled',
      );
    }
  }

  async registerProof(hash: string): Promise<string> {
    this.logger.log(`registerProof: ${hash} (not yet implemented)`);
    return `stellar-proof-${Date.now()}`;
  }

  async tokenizeNfe(data: TokenizeNfeInput): Promise<string> {
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

    // (B) Sem XML, deriva um hash único e determinístico da key (UUID) em vez de
    // 32 bytes zero — senão toda NF-e sem XML colidiria no contrato (AlreadyExists).
    const xmlHashBytes = data.xmlHash
      ? this.toBytes32(data.xmlHash)
      : createHash('sha256').update(data.key).digest();
    const valueInCentavos = BigInt(Math.round(data.value * 100));
    const dueDateUnix = BigInt(Math.floor(data.dueDate.getTime() / 1000));
    const platformAddress = platformKeypair.publicKey();

    // Step 1: tokenize with PME as owner, platform authorizes
    this.logger.log(`Tokenizing NF ${data.key} — owner: ${pmeAddress}`);
    this.logger.log(`data.xmlHash: ${data.xmlHash}`);
    let mintHash: string;
    try {
      mintHash = await this.invokeContract(
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
    } catch (error) {
      // (A) AlreadyExists (Error(Contract, #1)): key ou hash XML já tokenizado on-chain.
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Error(Contract, #1)')) {
        throw new ConflictException(
          'Esta NF-e já foi tokenizada on-chain (key ou hash XML já existe).',
        );
      }
      throw error;
    }
    this.logger.log(`NF tokenized — txHash: ${mintHash}`);

    return mintHash;
  }

  async transferNftToPlatform(receivableKey: string): Promise<string> {
    this.logger.log(`transferNftToPlatform — key: ${receivableKey}`);
    const { server, platformKeypair, contractId } =
      this.requireContractConfig();
    const platformAddress = platformKeypair.publicKey();

    this.logger.log(
      `Transferring NF ${receivableKey} ownership to platform: ${platformAddress}`,
    );
    const transferHash = await this.invokeContract(
      server,
      platformKeypair,
      contractId,
      'transfer_ownership',
      [
        nativeToScVal(receivableKey, { type: 'string' }),
        nativeToScVal(platformAddress, { type: 'address' }),
        nativeToScVal(platformAddress, { type: 'address' }),
      ],
    );
    this.logger.log(
      `NF transferred to platform custody — txHash: ${transferHash}`,
    );
    return transferHash;
  }

  async prepareAssignment(
    receivableKey: string,
    pmeAddress: string,
  ): Promise<{ unsignedXdr: string; hashToSign: string }> {
    this.logger.log(`Preparing assignment transaction for PME: ${pmeAddress}`);
    const { server, platformKeypair, contractId } =
      this.requireContractConfig();
    const platformAddress = platformKeypair.publicKey();

    const contract = new Contract(contractId);

    // Carrega a conta do PME (como sourceAccount da inner transaction)
    const pmeAccount = await this.horizon.loadAccount(pmeAddress);

    // Constrói a transação Soroban interna
    const operation = contract.call(
      'transfer_ownership',
      nativeToScVal(receivableKey, { type: 'string' }),
      nativeToScVal(platformAddress, { type: 'address' }),
    );

    const tx = new TransactionBuilder(pmeAccount, {
      fee: '100000', // Taxa básica simbólica para a transação interna
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    // Simula a transação para carregar os recursos exatos do Soroban
    const simResult = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(simResult)) {
      const simulationError = JSON.stringify(simResult);
      if (simulationError.includes('Error(Contract, #2)')) {
        throw new ConflictException(
          `Receivable ${receivableKey} is marked as tokenized locally, but was not found in the configured Stellar contract. Retokenize it or check STELLAR_NFE_CONTRACT_ID and STELLAR_NETWORK.`,
        );
      }

      throw new Error(
        `Soroban simulation failed for prepareAssignment: ${simulationError}`,
      );
    }

    // Monta a transação com os parâmetros corretos da simulação
    const assembledTx = rpc.assembleTransaction(tx, simResult).build();

    // Calcula o hash exato da transação a ser assinado
    const hashToSign = assembledTx.hash().toString('hex');

    // Retorna a transação em base64 (XDR não assinado) e seu hash
    return {
      unsignedXdr: assembledTx.toXDR(),
      hashToSign,
    };
  }

  async submitSignedAssignment(
    unsignedXdr: string,
    signatureHex: string,
    pmeAddress: string,
  ): Promise<string> {
    this.logger.log(`Submitting signed assignment transaction via Fee Bump`);
    const { server, platformKeypair } = this.requireContractConfig();

    // Decodifica a transação interna que já foi assinada pelo Privy do PME
    const innerTx = TransactionBuilder.fromXDR(
      unsignedXdr,
      NETWORK_PASSPHRASE,
    ) as any;

    // Decodifica a assinatura em formato hex do Privy e a aplica de forma segura
    const cleanSignature = signatureHex.replace(/^0x/, '');
    let signatureBuffer = Buffer.from(cleanSignature, 'hex');

    // Se a assinatura possuir bytes adicionais de recuperação (ex: 65 bytes da Privy/EVM),
    // truncamos para obter exatamente a assinatura ED25519 pura de 64 bytes.
    if (signatureBuffer.length > 64) {
      signatureBuffer = signatureBuffer.subarray(0, 64);
    }

    // Adiciona a assinatura decodificada formatada em Base64 na transação interna
    innerTx.addSignature(pmeAddress, signatureBuffer.toString('base64'));

    // Constrói a transação Fee Bump patrocinada pela plataforma
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      platformKeypair,
      BASE_FEE,
      innerTx,
      NETWORK_PASSPHRASE,
    );

    // Assina a transação Fee Bump externa com a chave privada da plataforma
    feeBumpTx.sign(platformKeypair);

    // Submete à Stellar RPC
    const sendResult = await server.sendTransaction(feeBumpTx as any);
    if (sendResult.status === 'ERROR') {
      throw new Error(
        `Stellar RPC rejected Fee Bump assignment: ${JSON.stringify(sendResult.errorResult)}`,
      );
    }

    // Aguarda confirmação no ledger
    await this.waitForConfirmation(sendResult.hash, server);
    this.logger.log(
      `Assignment transaction confirmed on-chain — txHash: ${sendResult.hash}`,
    );

    return sendResult.hash;
  }

  async payPme(data: PayPmeInput): Promise<string> {
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
      fee: BASE_FEE,
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
    const { platformKeypair } = this.requireContractConfig();

    const { publicKey: investorAddress, keypair: investorKeypair } =
      await this.ensureCustodialWalletForUser(data.investorUserId);
    if (!investorKeypair) {
      throw new Error(
        `Investor ${data.investorUserId} uses a Privy wallet; payment must be signed by Privy`,
      );
    }

    const platformAddress = platformKeypair.publicKey();
    const amount = data.amountBrl.toFixed(7);
    this.logger.log(
      `chargeInvestor — ${amount} TESOURO from ${investorAddress} → platform memo=${data.memo}`,
    );

    const sourceAccount = await this.horizon.loadAccount(investorAddress);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
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

    tx.sign(investorKeypair);
    const res = await this.submitWithDetail(tx, 'chargeInvestor');
    this.logger.log(`chargeInvestor confirmed — txHash: ${res.hash}`);
    return res.hash;
  }

  private async submitWithDetail(
    tx: import('@stellar/stellar-sdk').Transaction,
    label: string,
  ): Promise<{ hash: string }> {
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
    if (!this.walletSecret) {
      throw new Error('STELLAR_WALLET_SECRET not configured');
    }

    const keypair = this.deriveKeypair(googleId);
    const publicKey = keypair.publicKey();

    let isNew = false;
    try {
      await this.horizon.loadAccount(publicKey);
      this.logger.log(`Custodial wallet already exists: ${publicKey}`);
    } catch {
      try {
        const fundingTxHash = await this.fundAccountFromPlatform(publicKey, '5.0');
        isNew = true;
        this.logger.log(
          `[wallet] Nova carteira Stellar criada — publicKey: ${publicKey}, fundingTxHash: ${fundingTxHash}`,
        );
      } catch (err) {
        this.logger.error(
          `Platform funding failed for custodial wallet ${publicKey}: ${(err as Error).message}`,
        );
      }
    }

    if (isNew) {
      await this.establishTesourTrustline(keypair);
    }

    return publicKey;
  }

  async fundAccountFromPlatform(
    destination: string,
    startingBalance: string = '1.0',
  ): Promise<string | null> {
    const { platformKeypair } = this.requireContractConfig();
    const platformAddress = platformKeypair.publicKey();
    const targetBalance = Number(startingBalance);

    let destinationAccount: HorizonAccountResponse | null = null;
    try {
      destinationAccount = await this.horizon.loadAccount(destination);
    } catch {
      // Account does not exist, proceed to fund/create it
    }

    if (destinationAccount) {
      const nativeBalanceLine = destinationAccount.balances.find(
        (balance) => balance.asset_type === 'native',
      );
      const nativeBalance = Number(nativeBalanceLine?.balance ?? '0');

      if (this.isMainnet || nativeBalance >= MINIMUM_TESTNET_XLM_BALANCE) {
        this.logger.log(
          `Account ${destination} already exists with ${nativeBalance} XLM — no funding needed.`,
        );
        return null;
      }

      const topUpAmount = targetBalance - nativeBalance;
      if (topUpAmount <= 0) {
        this.logger.log(
          `Account ${destination} already has the target XLM balance — no funding needed.`,
        );
        return null;
      }

      this.logger.log(
        `Topping up account ${destination} from ${nativeBalance} to ${targetBalance} XLM...`,
      );

      const sourceAccount = await this.horizon.loadAccount(platformAddress);
      const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount: topUpAmount.toFixed(7),
          }),
        )
        .setTimeout(TX_TIMEOUT_SECONDS)
        .build();

      tx.sign(platformKeypair);
      const res = await this.submitWithDetail(tx, 'fundAccountFromPlatform');
      this.logger.log(
        `Account ${destination} topped up successfully via platform — txHash: ${res.hash}`,
      );
      return res.hash;
    }

    if (this.isMainnet) {
      throw new Error(
        `Mainnet wallet creation for ${destination} requires manual funding`,
      );
    }

    this.logger.log(
      `Funding new account ${destination} from platform ${platformAddress} with ${startingBalance} XLM...`,
    );

    const sourceAccount = await this.horizon.loadAccount(platformAddress);
    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.createAccount({
          destination,
          startingBalance,
        }),
      )
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    tx.sign(platformKeypair);
    const res = await this.submitWithDetail(tx, 'fundAccountFromPlatform');
    this.logger.log(
      `Account ${destination} created successfully via platform — txHash: ${res.hash}`,
    );
    return res.hash;
  }

  private async invokeContract(
    server: rpc.Server,
    signerKeypair: Keypair,
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<string> {
    const contract = new Contract(contractId);
    const sourceAccount = await this.horizon.loadAccount(
      signerKeypair.publicKey(),
    );

    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
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
    const publicKey = keypair.publicKey();
    try {
      const account = await this.horizon.loadAccount(publicKey);
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
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
    const seed = createHmac('sha256', this.walletSecret)
      .update(seedSource)
      .digest();
    return Keypair.fromRawEd25519Seed(seed);
  }

  private async ensureCustodialWalletForUser(
    userId: string,
  ): Promise<{ publicKey: string; keypair: Keypair | null }> {
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

    if (user.privyStellarWalletAddress) {
      return { publicKey: user.privyStellarWalletAddress, keypair: null };
    }

    const seedSource = user.googleId ?? user.id;
    const keypair = this.deriveKeypair(seedSource);
    const publicKey = keypair.publicKey();

    if (user.stellarWalletId && user.stellarWalletId !== publicKey) {
      throw new Error(
        `Wallet mismatch for user ${userId} — stored ${user.stellarWalletId} vs derived ${publicKey}`,
      );
    }

    try {
      await this.horizon.loadAccount(publicKey);
    } catch {
      try {
        const fundingTxHash = await this.fundAccountFromPlatform(publicKey, '5.0');
        this.logger.log(
          `[wallet] Nova carteira Stellar criada — userId: ${userId}, publicKey: ${publicKey}, fundingTxHash: ${fundingTxHash}`,
        );
      } catch (err) {
        throw new Error(
          `Platform funding failed for custodial wallet ${publicKey}: ${(err as Error).message}`,
        );
      }
    }

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
    if (!this.server || !this.platformKeypair || !this.contractId) {
      throw new Error(
        'Stellar contract not configured — set STELLAR_RPC_URL, STELLAR_SECRET_KEY, STELLAR_NFE_CONTRACT_ID',
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
    if (!hexHash) return Buffer.alloc(32);
    const clean = hexHash.replace(/^0x/, '');
    const isHex = /^[0-9a-fA-F]{64}$/.test(clean);
    if (isHex) {
      return Buffer.from(clean, 'hex');
    }
    // Caso não seja um hash hex de 32 bytes válido (ex: strings de teste ou hashes arbitrários),
    // gera um hash SHA-256 da própria string para garantir um buffer de 32 bytes válido.
    return createHash('sha256').update(hexHash).digest();
  }

  async depositToPool(
    investorUserId: string,
    amountBrl: number,
  ): Promise<string> {
    this.logger.log(
      `depositToPool — investor: ${investorUserId}, amount: ${amountBrl}`,
    );

    const poolContractId = process.env.STELLAR_POOL_CONTRACT_ID;
    const brltContractId = process.env.STELLAR_BRLT_TOKEN_ID;
    if (
      !poolContractId ||
      !brltContractId ||
      !this.server ||
      !this.platformKeypair
    ) {
      this.logger.warn(
        'STELLAR_POOL_CONTRACT_ID, BRLT or credentials not configured — returning mock tx hash',
      );
      return `stellar-mock-pool-deposit-${Date.now()}`;
    }

    const { publicKey: investorAddress, keypair: investorKeypair } =
      await this.ensureCustodialWalletForUser(investorUserId);

    if (!investorKeypair) {
      throw new Error(
        `Custodial keypair for investor ${investorUserId} not available to sign transaction`,
      );
    }

    // A precisão padrão dos tokens SEP-41 é de 7 casas decimais
    const amountInStroops = BigInt(Math.round(amountBrl * 10_000_000));

    // Passo 1: Mint de BRLT da plataforma para a carteira do Investidor
    this.logger.log(
      `Step 1: Minting ${amountBrl} BRLT to investor ${investorAddress}...`,
    );
    await this.invokeContract(
      this.server,
      this.platformKeypair,
      brltContractId,
      'mint',
      [
        nativeToScVal(this.platformKeypair.publicKey(), { type: 'address' }), // admin
        nativeToScVal(investorAddress, { type: 'address' }),
        nativeToScVal(amountInStroops, { type: 'i128' }),
      ],
    );

    // Obter ledger atual para expiração do approve
    const latestLedgers = await this.horizon
      .ledgers()
      .order('desc')
      .limit(1)
      .call();
    const currentLedger = latestLedgers.records[0]?.sequence ?? 3000000;
    const liveUntilLedger = currentLedger + 100000;

    // Passo 2: Approve do Investidor para a Pool gastar o BRLT dele
    this.logger.log(
      `Step 2: Approving Pool to spend ${amountBrl} BRLT from investor...`,
    );
    await this.invokeContract(
      this.server,
      investorKeypair, // <-- Assinado pelo investidor
      brltContractId,
      'approve',
      [
        nativeToScVal(investorAddress, { type: 'address' }),
        nativeToScVal(poolContractId, { type: 'address' }),
        nativeToScVal(amountInStroops, { type: 'i128' }),
        nativeToScVal(liveUntilLedger, { type: 'u32' }),
      ],
    );

    // Passo 3: Deposit do Investidor na Pool
    this.logger.log(
      `Step 3: Depositing ${amountBrl} BRLT from investor to Pool...`,
    );
    const txHash = await this.invokeContract(
      this.server,
      investorKeypair, // <-- Assinado pelo investidor
      poolContractId,
      'deposit',
      [
        nativeToScVal(investorAddress, { type: 'address' }),
        nativeToScVal(amountInStroops, { type: 'i128' }),
      ],
    );

    this.logger.log(
      `Deposit sequence completed successfully — txHash: ${txHash}`,
    );
    return txHash;
  }

  async withdrawFromPool(
    investorUserId: string,
    shareAmount: number,
  ): Promise<string> {
    this.logger.log(
      `withdrawFromPool — investor: ${investorUserId}, shares: ${shareAmount}`,
    );

    const poolContractId = process.env.STELLAR_POOL_CONTRACT_ID;
    if (!poolContractId || !this.server || !this.platformKeypair) {
      this.logger.warn(
        'STELLAR_POOL_CONTRACT_ID or credentials not configured — returning mock tx hash',
      );
      return `stellar-mock-pool-withdraw-${Date.now()}`;
    }

    const { publicKey: investorAddress, keypair: investorKeypair } =
      await this.ensureCustodialWalletForUser(investorUserId);

    if (!investorKeypair) {
      throw new Error(
        `Custodial keypair for investor ${investorUserId} not available to sign transaction`,
      );
    }

    // A precisão padrão das cotas é de 7 casas decimais
    const sharesInStroops = BigInt(Math.round(shareAmount * 10_000_000));

    return this.invokeContract(
      this.server,
      investorKeypair, // <-- Assinado pelo investidor
      poolContractId,
      'withdraw',
      [
        nativeToScVal(investorAddress, { type: 'address' }),
        nativeToScVal(sharesInStroops, { type: 'i128' }),
      ],
    );
  }

  async settleInvoiceInPool(
    invoiceHash: string,
    advanceAmountBrl: number,
  ): Promise<string> {
    this.logger.log(
      `settleInvoiceInPool — invoiceHash: ${invoiceHash}, amount: ${advanceAmountBrl}`,
    );

    const poolContractId = process.env.STELLAR_POOL_CONTRACT_ID;
    if (!poolContractId || !this.server || !this.platformKeypair) {
      this.logger.warn(
        'STELLAR_POOL_CONTRACT_ID or credentials not configured — returning mock tx hash',
      );
      return `stellar-mock-pool-settlement-${Date.now()}`;
    }

    // A precisão padrão do BRLT é de 7 casas decimais
    const amountInStroops = BigInt(Math.round(advanceAmountBrl * 10_000_000));
    const cleanHashBytes = this.toBytes32(invoiceHash);

    return this.invokeContract(
      this.server,
      this.platformKeypair,
      poolContractId,
      'settle_invoice_in_pool',
      [
        nativeToScVal(this.platformKeypair.publicKey(), { type: 'address' }),
        xdr.ScVal.scvBytes(cleanHashBytes),
        nativeToScVal(amountInStroops, { type: 'i128' }),
      ],
    );
  }

  async buyTokenizedInvoiceInPool(data: {
    sellerAddress: string;
    invoiceKey: string;
    xmlHash: string;
    value: number;
  }): Promise<string> {
    this.logger.log(
      `buyTokenizedInvoiceInPool — key: ${data.invoiceKey}, seller: ${data.sellerAddress}`,
    );
    const { server, platformKeypair } = this.requireContractConfig();
    const poolContractId = process.env.STELLAR_POOL_CONTRACT_ID;
    if (!poolContractId) {
      throw new Error('STELLAR_POOL_CONTRACT_ID not configured');
    }

    // A precisão padrão dos tokens SEP-41 é de 7 casas decimais
    const valueInStroops = BigInt(Math.round(data.value * 10_000_000));
    const cleanHashBytes = this.toBytes32(data.xmlHash);
    const platformAddress = platformKeypair.publicKey();

    // Data futura simbólica de maturidade para fins de simulação de pool (Unix timestamp 1800000000 = ~2027)
    const maturityTimestamp = BigInt(1800000000);

    const poolTxHash = await this.invokeContract(
      server,
      platformKeypair,
      poolContractId,
      'buy_tokenized_invoice',
      [
        nativeToScVal(platformAddress, { type: 'address' }), // operator
        nativeToScVal(data.sellerAddress, { type: 'address' }), // seller (PME)
        xdr.ScVal.scvBytes(cleanHashBytes), // invoice_hash
        nativeToScVal(valueInStroops, { type: 'i128' }), // face_value
        nativeToScVal(valueInStroops, { type: 'i128' }), // advance_amount (mesmo valor ou proporção)
        nativeToScVal(100n, { type: 'i128' }), // rate_bps (ex: 1% diário, simbólico)
        nativeToScVal(maturityTimestamp, { type: 'u64' }), // maturity_timestamp
      ],
    );
    this.logger.log(
      `buyTokenizedInvoiceInPool confirmed — txHash: ${poolTxHash}, key: ${data.invoiceKey}, seller (PME): ${data.sellerAddress}, operator (plataforma/contrato): ${platformAddress}, pool: ${poolContractId}, valor: ${data.value}`,
    );
    return poolTxHash;
  }

  async mintBrlt(toAddress: string, amount: number): Promise<string> {
    this.logger.log(`mintBrlt — to: ${toAddress}, amount: ${amount}`);
    const { server, platformKeypair } = this.requireContractConfig();
    const brltContractId = process.env.STELLAR_BRLT_TOKEN_ID;
    if (!brltContractId) {
      throw new Error('STELLAR_BRLT_TOKEN_ID not configured');
    }

    // A precisão padrão dos tokens SEP-41 é de 7 casas decimais
    const amountInStroops = BigInt(Math.round(amount * 10_000_000));

    return this.invokeContract(
      server,
      platformKeypair,
      brltContractId,
      'mint',
      [
        nativeToScVal(platformKeypair.publicKey(), { type: 'address' }),
        nativeToScVal(toAddress, { type: 'address' }),
        nativeToScVal(amountInStroops, { type: 'i128' }),
      ],
    );
  }

  /**
   * Builds and assembles a simulated Soroban transaction ready for signing by a Privy wallet.
   * Uses the investor's address as the source account (they pay fees and provide auth).
   */
  private async buildAndAssemble(
    investorAddress: string,
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<UnsignedSorobanTx> {
    if (!this.server) {
      throw new Error('Stellar RPC server not configured');
    }

    const account = await this.server.getAccount(investorAddress);
    const contract = new Contract(contractId);

    let tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(CLIENT_SIGNED_TX_TIMEOUT_SECONDS)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      throw new Error(
        `Simulation failed for ${method}: ${JSON.stringify(sim)}`,
      );
    }

    tx = rpc.assembleTransaction(tx, sim).build();

    return {
      xdr: tx.toXDR(),
      hashToSign: tx.hash().toString('hex'),
      signerPublicKey: investorAddress,
    };
  }

  async buildApproveTx(
    investorAddress: string,
    amountBrl: number,
  ): Promise<UnsignedSorobanTx> {
    this.logger.log(
      `buildApproveTx — investor ${investorAddress}, amount ${amountBrl}`,
    );

    const poolContractId = process.env.STELLAR_POOL_CONTRACT_ID;
    const brltContractId = process.env.STELLAR_BRLT_TOKEN_ID;
    if (!poolContractId || !brltContractId) {
      throw new Error(
        'STELLAR_POOL_CONTRACT_ID / STELLAR_BRLT_TOKEN_ID not configured',
      );
    }

    // SEP-41 tokens use 7 decimal places (stroops)
    const amountInStroops = BigInt(Math.round(amountBrl * 10_000_000));

    const latestLedgers = await this.horizon
      .ledgers()
      .order('desc')
      .limit(1)
      .call();
    const currentLedger = latestLedgers.records[0]?.sequence ?? 3000000;
    const liveUntilLedger = currentLedger + 100000;

    return this.buildAndAssemble(investorAddress, brltContractId, 'approve', [
      nativeToScVal(investorAddress, { type: 'address' }),
      nativeToScVal(poolContractId, { type: 'address' }),
      nativeToScVal(amountInStroops, { type: 'i128' }),
      nativeToScVal(liveUntilLedger, { type: 'u32' }),
    ]);
  }

  async buildDepositTx(
    investorAddress: string,
    amountBrl: number,
  ): Promise<UnsignedSorobanTx> {
    const poolContractId = process.env.STELLAR_POOL_CONTRACT_ID;
    if (!poolContractId) {
      throw new Error('STELLAR_POOL_CONTRACT_ID not configured');
    }

    // SEP-41 tokens use 7 decimal places (stroops)
    const amountInStroops = BigInt(Math.round(amountBrl * 10_000_000));

    this.logger.log(
      `buildDepositTx — investor ${investorAddress}, amount ${amountBrl}`,
    );

    return this.buildAndAssemble(investorAddress, poolContractId, 'deposit', [
      nativeToScVal(investorAddress, { type: 'address' }),
      nativeToScVal(amountInStroops, { type: 'i128' }),
    ]);
  }

  async buildBurnBrltTx(
    userAddress: string,
    amountBrl: number,
  ): Promise<UnsignedSorobanTx> {
    const brltContractId = process.env.STELLAR_BRLT_TOKEN_ID;
    if (!brltContractId) {
      throw new Error('STELLAR_BRLT_TOKEN_ID not configured');
    }

    // SEP-41 tokens use 7 decimal places (stroops)
    const amountInStroops = BigInt(Math.round(amountBrl * 10_000_000));

    this.logger.log(
      `buildBurnBrltTx — user ${userAddress}, amount ${amountBrl}`,
    );

    return this.buildAndAssemble(userAddress, brltContractId, 'burn', [
      nativeToScVal(userAddress, { type: 'address' }),
      nativeToScVal(amountInStroops, { type: 'i128' }),
    ]);
  }


  async submitSignedTx(input: {
    xdr: string;
    signerPublicKey: string;
    signatureHex: string;
  }): Promise<string> {
    if (!this.server) {
      throw new Error('Stellar RPC server not configured');
    }
    const { platformKeypair } = this.requireContractConfig();

    const innerTx = TransactionBuilder.fromXDR(
      input.xdr,
      NETWORK_PASSPHRASE,
    ) as import('@stellar/stellar-sdk').Transaction;

    const keypair = Keypair.fromPublicKey(input.signerPublicKey);
    const signature = Buffer.from(
      input.signatureHex.replace(/^0x/, ''),
      'hex',
    );

    if (!keypair.verify(innerTx.hash(), signature)) {
      throw new Error('Signature does not match transaction hash');
    }

    // Aplica a assinatura do investidor (Privy) na transação interna.
    innerTx.addDecoratedSignature(
      new xdr.DecoratedSignature({
        hint: keypair.signatureHint(),
        signature,
      }),
    );

    // Envolve numa Fee Bump patrocinada pela carteira da plataforma (CredBridge),
    // que passa a pagar o fee — inclusive o resource fee Soroban — em vez do investidor.
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      platformKeypair,
      BASE_FEE,
      innerTx,
      NETWORK_PASSPHRASE,
    );
    feeBumpTx.sign(platformKeypair);

    const sendResult = await this.server.sendTransaction(feeBumpTx as any);
    if (sendResult.status === 'ERROR') {
      throw new Error(
        `sendTransaction failed: ${JSON.stringify(sendResult.errorResult)}`,
      );
    }

    await this.waitForConfirmation(sendResult.hash, this.server);
    this.logger.log(`submitSignedTx confirmed — hash ${sendResult.hash}`);
    return sendResult.hash;
  }

  // -----------------------------------------------------------------------
  // Leitura read-only de contrato (simulação — sem assinar, sem fee)
  // -----------------------------------------------------------------------
  private async simulateRead(
    contractId: string,
    method: string,
    args: xdr.ScVal[] = [],
  ): Promise<unknown> {
    const { server, platformKeypair } = this.requireContractConfig();

    const account = await server.getAccount(platformKeypair.publicKey());
    const contract = new Contract(contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      throw new Error(`Simulation failed for ${method}: ${JSON.stringify(sim)}`);
    }
    if (sim.result == null || sim.result.retval == null) {
      throw new Error(`No return value from ${method}`);
    }
    return scValToNative(sim.result.retval);
  }

  async getPoolStatus(): Promise<PoolStatus> {
    const poolId = process.env.STELLAR_POOL_CONTRACT_ID;
    if (!poolId) {
      throw new Error('STELLAR_POOL_CONTRACT_ID not configured');
    }

    const state = (await this.simulateRead(poolId, 'get_pool_state', [])) as {
      admin: string;
      operator: string;
      asset_address: string;
      share_token_address: string;
      total_principal: bigint;
      total_shares: bigint;
      paused: boolean;
    };
    // Estas leituras são independentes entre si — dispara em paralelo.
    const [navRaw, sharePriceRaw, brltDecimalsRaw, shareDecimalsRaw] =
      await Promise.all([
        this.simulateRead(poolId, 'get_nav', []) as Promise<bigint>,
        this.simulateRead(poolId, 'get_share_price', []) as Promise<bigint>,
        this.simulateRead(state.asset_address, 'decimals', []),
        this.simulateRead(state.share_token_address, 'decimals', []),
      ]);
    const brltDecimals = Number(brltDecimalsRaw);
    const shareDecimals = Number(shareDecimalsRaw);

    const cashRaw = navRaw - state.total_principal;
    const toScaled = (raw: bigint, decimals: number): Scaled => ({
      raw: raw.toString(),
      value: Number(raw) / 10 ** decimals,
    });

    return {
      poolContractId: poolId,
      brltTokenId: state.asset_address,
      shareTokenId: state.share_token_address,
      admin: state.admin,
      operator: state.operator,
      paused: state.paused,
      brltDecimals,
      shareDecimals,
      nav: toScaled(navRaw, brltDecimals),
      cashBalance: toScaled(cashRaw, brltDecimals),
      totalPrincipal: toScaled(state.total_principal, brltDecimals),
      totalShares: toScaled(state.total_shares, shareDecimals),
      // sharePrice é ponto-fixo de 9 casas (PRICE_SCALE do contrato), não decimais SEP-41.
      sharePrice: {
        raw: sharePriceRaw.toString(),
        value: Number(sharePriceRaw) / 1e9,
      },
    };
  }

  async getInvestorShares(address: string): Promise<InvestorShares> {
    const poolId = process.env.STELLAR_POOL_CONTRACT_ID;
    if (!poolId) {
      throw new Error('STELLAR_POOL_CONTRACT_ID not configured');
    }

    const state = (await this.simulateRead(poolId, 'get_pool_state', [])) as {
      share_token_address: string;
    };
    // Leituras independentes — dispara em paralelo.
    const [shareDecimalsRaw, sharePriceRaw, balanceRaw] = await Promise.all([
      this.simulateRead(state.share_token_address, 'decimals', []),
      this.simulateRead(poolId, 'get_share_price', []) as Promise<bigint>,
      this.simulateRead(state.share_token_address, 'balance', [
        nativeToScVal(address, { type: 'address' }),
      ]) as Promise<bigint>,
    ]);
    const shareDecimals = Number(shareDecimalsRaw);

    const sharesValue = Number(balanceRaw) / 10 ** shareDecimals;
    const sharePriceValue = Number(sharePriceRaw) / 1e9;

    return {
      address,
      shares: { raw: balanceRaw.toString(), value: sharesValue },
      estimatedValueBrl: sharesValue * sharePriceValue,
    };
  }

  async getBrltBalance(address: string): Promise<WalletBalance> {
    const brltId = process.env.STELLAR_BRLT_TOKEN_ID;
    if (!brltId) {
      throw new Error('STELLAR_BRLT_TOKEN_ID not configured');
    }

    // Leituras independentes — dispara em paralelo.
    const [decimalsRaw, balanceRaw] = await Promise.all([
      this.simulateRead(brltId, 'decimals', []),
      this.simulateRead(brltId, 'balance', [
        nativeToScVal(address, { type: 'address' }),
      ]) as Promise<bigint>,
    ]);
    const decimals = Number(decimalsRaw);

    return {
      address,
      tokenId: brltId,
      balance: {
        raw: balanceRaw.toString(),
        value: Number(balanceRaw) / 10 ** decimals,
      },
    };
  }
}
