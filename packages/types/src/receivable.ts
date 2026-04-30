export type ReceivableStatus = 'pending' | 'validated' | 'settled' | 'defaulted';
export type ReceivableType = 'invoice' | 'duplicate' | 'contract';

export interface Receivable {
  id: string;
  userId: string;
  value: number;
  type: ReceivableType;
  status: ReceivableStatus;
  documentHash?: string;
  txHash?: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReceivableInput {
  userId: string;
  value: number;
  type: ReceivableType;
  dueDate: string;
}
