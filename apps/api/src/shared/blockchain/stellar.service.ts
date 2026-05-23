import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
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

const BASE_FEE = '1000000'; // 0.1 XLM — generous for Soroban ops
const TESOURO_ISSUER =
  'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4';
const TESOURO = new Asset('TESOURO', TESOURO_ISSUER);
const TX_TIMEOUT_SECONDS = 30;
const POLL_INTERVAL_MS = 2000;
const POLL_DEADLINE_MS = 60_000;

@Injectable()
export class StellarService implements BlockchainService {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: rpc.Server | undefined;
  private readonly horizon: Horizon.Server;
  private readonly platformKeypair: Keypair | undefined;
  private readonly contractId: string | undefined;
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
    this.logger.log(
      `tokenizeNfe — key: ${data.key}, value: ${data.value}, owner: ${data.ownerUserId}`,
    );

    const { server, platformKeypair, contractId } =
      this.requireContractConfig();

    // Look up PME's custodial wallet
    const user = await this.prisma.user.findUnique({
      where: { id: data.ownerUserId },
      select: { stellarWalletId: true, googleId: true },
    });
    if (!user?.stellarWalletId || !user?.googleId) {
      throw new Error(
        `PME ${data.ownerUserId} has no Stellar wallet — cannot tokenize`,
      );
    }
    const pmeAddress = user.stellarWalletId;

    const xmlHashBytes = this.toBytes32(data.xmlHash);
    const valueInCentavos = BigInt(Math.round(data.value * 100));
    const dueDateUnix = BigInt(Math.floor(data.dueDate.getTime() / 1000));
    const platformAddress = platformKeypair.publicKey();

    // Step 1: tokenize with PME as owner, platform authorizes
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

    // Step 2: transfer ownership to platform (CredBridge receives the receivable)
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
      if (this.isMainnet) {
        throw new Error('Mainnet custodial wallet requires manual funding');
      }
      this.logger.log(`Funding new testnet wallet via Friendbot: ${publicKey}`);
      const res = await fetch(
        `https://friendbot.stellar.org?addr=${publicKey}`,
      );
      if (!res.ok) {
        this.logger.warn(
          `Friendbot failed (${res.status}) for ${publicKey} — wallet unfunded`,
        );
      } else {
        isNew = true;
      }
    }

    if (isNew) {
      await this.establishTesourTrustline(keypair);
    }

    return publicKey;
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
  ): Promise<{ publicKey: string; keypair: Keypair }> {
    if (!this.walletSecret) {
      throw new Error('STELLAR_WALLET_SECRET not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, googleId: true, stellarWalletId: true },
    });
    if (!user) {
      throw new Error(`User ${userId} not found`);
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
      if (this.isMainnet) {
        throw new Error(
          `Mainnet wallet for user ${userId} requires manual funding`,
        );
      }
      this.logger.log(`Funding new testnet wallet via Friendbot: ${publicKey}`);
      const res = await fetch(
        `https://friendbot.stellar.org?addr=${publicKey}`,
      );
      if (!res.ok) {
        throw new Error(
          `Friendbot funding failed (${res.status}) for ${publicKey}`,
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
    const clean = hexHash.replace(/^0x/, '').padEnd(64, '0').slice(0, 64);
    return Buffer.from(clean, 'hex');
  }
}
