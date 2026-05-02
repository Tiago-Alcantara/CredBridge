export type SettlementStatus = 'pending' | 'completed' | 'failed';
export type SettlementMethod = 'pix' | 'ted' | 'stellar';

export interface Settlement {
  id: string;
  receivableId: string;
  amount: number;
  method: SettlementMethod;
  status: SettlementStatus;
  txHash?: string;
  stellarTxHash?: string;
  settledAt?: string;
  createdAt: string;
}

export interface CreateSettlementInput {
  receivableId: string;
  amount: number;
  method: SettlementMethod;
}
