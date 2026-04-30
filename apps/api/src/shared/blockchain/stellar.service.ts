import { Injectable, Logger } from '@nestjs/common';
import { BlockchainService } from './blockchain.interface';

@Injectable()
export class StellarService implements BlockchainService {
  private readonly logger = new Logger(StellarService.name);

  async registerProof(hash: string): Promise<string> {
    this.logger.log(`registerProof called with hash: ${hash}`);
    // TODO: implement Stellar SDK integration
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
