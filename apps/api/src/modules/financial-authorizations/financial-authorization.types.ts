export const FINANCIAL_AUTH_DOMAIN = 'credbridge.finance.authorization';
export const FINANCIAL_AUTH_VERSION = '1';

export type FinancialOperation =
  | 'receivable.tokenize'
  | 'receivable.assignment'
  | 'pme.withdrawal'
  | 'investor.deposit'
  | 'investment.purchase'
  | 'investor.withdrawal';

export const DIRECT_AUTH_OPERATIONS = new Set<FinancialOperation>([
  'receivable.assignment',
  'pme.withdrawal',
  'investor.deposit',
  'investment.purchase',
  'investor.withdrawal',
]);

export interface FinancialAuthorizationPayload {
  domain: typeof FINANCIAL_AUTH_DOMAIN;
  version: typeof FINANCIAL_AUTH_VERSION;
  network: string;
  operation: FinancialOperation;
  userId: string;
  walletId: string;
  resourceId: string | null;
  amount: string | null;
  destination: string | null;
  nonce: string;
  expiresAt: string;
}

export interface FinancialAuthorizationConsumption {
  authorizationId: string;
  userId: string;
  operation: FinancialOperation;
  resourceId?: string | null;
  amount?: string | null;
  destination?: string | null;
}
