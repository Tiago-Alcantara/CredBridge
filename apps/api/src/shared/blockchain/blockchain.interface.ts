export interface TokenizeNfeInput {
  key: string;
  value: number;
  dueDate: Date;
  xmlHash: string | null;
  ownerUserId: string;
}

export interface BlockchainService {
  registerProof(hash: string): Promise<string>;
  tokenizeNfe(data: TokenizeNfeInput): Promise<string>;
  settlePayment(data: { receivableId: string; amount: number; destination: string }): Promise<string>;
  getTransactionStatus(txHash: string): Promise<'pending' | 'success' | 'failed'>;
}

export const BLOCKCHAIN_SERVICE = Symbol('BLOCKCHAIN_SERVICE');
