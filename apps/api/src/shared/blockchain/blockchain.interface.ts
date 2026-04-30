export interface BlockchainService {
  registerProof(hash: string): Promise<string>;
  settlePayment(data: { receivableId: string; amount: number; destination: string }): Promise<string>;
  getTransactionStatus(txHash: string): Promise<'pending' | 'success' | 'failed'>;
}

export const BLOCKCHAIN_SERVICE = Symbol('BLOCKCHAIN_SERVICE');
