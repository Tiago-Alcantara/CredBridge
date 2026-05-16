export interface ReceivableResponse {
  id: string;
  value: number;
  type: string;
  status: string;
  debtorName: string;
  debtorDocument: string;
  dueDate: Date;
  createdAt: Date;
  txHash: string | null;
  paymentTxHash: string | null;
}

export function toReceivableResponse(r: {
  id: string;
  value: number;
  type: string;
  status: string;
  debtorName: string;
  debtorDocument: string;
  dueDate: Date;
  createdAt: Date;
  txHash?: string | null;
  paymentTxHash?: string | null;
}): ReceivableResponse {
  return {
    id: r.id,
    value: r.value,
    type: r.type,
    status: r.status,
    debtorName: r.debtorName,
    debtorDocument: r.debtorDocument,
    dueDate: r.dueDate,
    createdAt: r.createdAt,
    txHash: r.txHash ?? null,
    paymentTxHash: r.paymentTxHash ?? null,
  };
}
