export type PaymentMethod = 'pix' | 'ted';
export type PaymentStatus = 'pending' | 'completed' | 'failed';

export interface PaymentResult {
  txId: string;
  status: PaymentStatus;
  processedAt?: string;
}

export interface PaymentsService {
  send(data: {
    amount: number;
    method: PaymentMethod;
    destination: string;
    description: string;
  }): Promise<PaymentResult>;
  getStatus(txId: string): Promise<PaymentStatus>;
}

export const PAYMENTS_SERVICE = Symbol('PAYMENTS_SERVICE');
