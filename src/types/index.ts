export type ReceivableStatus = "pending" | "active" | "completed" | "defaulted";

export type DocumentType = "nota_fiscal" | "duplicata" | "contrato" | "outro";

export type PaymentMethod = "pix" | "ted" | "stellar";

export type UserRole = "pme" | "investor" | "partner";

export type Lang = "pt" | "en";

export interface Receivable {
  id: string;
  amount: number;
  dueDate: string;
  debtorName: string;
  debtorDocument: string;
  status: ReceivableStatus;
  createdAt: string;
  onChainTxHash?: string;
}

export interface Document {
  id: string;
  receivableId: string;
  type: DocumentType;
  url: string;
  hash: string;
  createdAt: string;
}

export interface Settlement {
  id: string;
  receivableId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: "pending" | "completed" | "failed";
  onChainTxHash?: string;
  settledAt?: string;
}

export interface AuditEvent {
  id: string;
  entityId: string;
  action: string;
  actor: string;
  metadata: Record<string, unknown>;
  onChainTxHash?: string;
  createdAt: string;
}
