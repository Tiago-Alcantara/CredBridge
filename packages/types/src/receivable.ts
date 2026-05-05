export type ReceivableStatus = 'pending' | 'validated' | 'active' | 'settled' | 'defaulted';
export type ReceivableType = 'invoice' | 'duplicate' | 'contract';

export interface Receivable {
  id: string;
  userId: string;
  value: number;
  type: ReceivableType;
  status: ReceivableStatus;
  debtorName: string;
  debtorDocument: string;
  documentHash?: string;
  txHash?: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReceivableInput {
  value: number;
  type: ReceivableType;
  debtorName: string;
  debtorDocument: string;
  dueDate: string;
}
