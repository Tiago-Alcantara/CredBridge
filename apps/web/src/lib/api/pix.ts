import { apiFetch } from './client';

export interface UnsignedSorobanTx {
  xdr: string;
  hashToSign: string;
  signerPublicKey: string;
}

export interface BuildWithdrawalResponse {
  xdr: string;
  hashToSign: string;
  signerPublicKey: string;
}

export interface SubmitWithdrawalInput {
  amount: number;
  pixKey: string;
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  xdr: string;
  signature: string;
}

export interface SubmitWithdrawalResponse {
  status: string;
  txHash: string;
  pixOrderId: string;
}

export function buildWithdrawalTx(amount: number) {
  return apiFetch<BuildWithdrawalResponse>('/pix/withdrawals/build', {
    method: 'POST',
    body: { amount },
  });
}

export function submitWithdrawal(body: SubmitWithdrawalInput) {
  return apiFetch<SubmitWithdrawalResponse>('/pix/withdrawals/submit', {
    method: 'POST',
    body,
  });
}
