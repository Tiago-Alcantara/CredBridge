import { Injectable, Logger } from '@nestjs/common';
import type { BlockchainService, TokenizeNfeInput } from './blockchain.interface';

@Injectable()
export class StellarService implements BlockchainService {
  private readonly logger = new Logger(StellarService.name);

  async registerProof(hash: string): Promise<string> {
    this.logger.log(`registerProof called with hash: ${hash}`);
    // TODO: implement Stellar SDK integration
    return `stellar-tx-${Date.now()}`;
  }

  async tokenizeNfe(data: TokenizeNfeInput): Promise<string> {
    this.logger.log(
      `tokenizeNfe called — key: ${data.key}, value: ${data.value}, dueDate: ${data.dueDate.toISOString()}, xmlHash: ${data.xmlHash ?? 'none'}, owner: ${data.ownerUserId}`,
    );
    // TODO: invoke tokenize_nfe() on the Soroban contract via Stellar SDK
    // Steps:
    //   1. Load platform keypair from env (STELLAR_SECRET_KEY)
    //   2. Build Soroban transaction calling CONTRACT_ID::tokenize_nfe
    //   3. Sign and submit via Horizon/RPC
    //   4. Return the transaction hash
    return `stellar-tx-${Date.now()}`;
  }

  async settlePayment(data: { receivableId: string; amount: number; destination: string }): Promise<string> {
    this.logger.log(`settlePayment called for receivable: ${data.receivableId}`);
    // TODO: implement Stellar SDK integration
    return `stellar-tx-${Date.now()}`;
  }

  async getTransactionStatus(txHash: string): Promise<'pending' | 'success' | 'failed'> {
    this.logger.log(`getTransactionStatus called for: ${txHash}`);
    // TODO: implement Stellar SDK integration
    return 'success';
  }
}
