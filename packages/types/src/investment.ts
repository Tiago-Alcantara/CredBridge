import type { Receivable } from './receivable';

export type InvestmentStatus = 'active' | 'settled' | 'defaulted';

export interface Investment {
  id: string;
  investorUserId: string;
  receivableId: string;
  amountPaid: number;
  faceValue: number;
  discountRate: number;
  status: InvestmentStatus;
  pixTxId?: string;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
  receivable?: Receivable;
}

export interface CreateInvestmentInput {
  receivableId: string;
  pixTxId?: string;
}

export interface InvestorPositionStats {
  totalInvested: number;
  expectedReturn: number;
  activePositions: number;
}
