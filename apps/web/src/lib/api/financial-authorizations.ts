import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';

export type FinancialOperation =
  | 'receivable.tokenize'
  | 'receivable.assignment'
  | 'pme.withdrawal'
  | 'investor.deposit'
  | 'investment.purchase'
  | 'investor.withdrawal';

export interface FinancialAuthorizationPayload {
  domain: string;
  version: string;
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

export interface CreateFinancialAuthorizationInput {
  operation: FinancialOperation;
  resourceId?: string;
  amount?: string;
  destination?: string;
}

export interface FinancialAuthorizationChallenge {
  authorizationId: string;
  payload: FinancialAuthorizationPayload;
  payloadHash: string;
  expiresAt: string;
}

export function useCreateFinancialAuthorizationChallenge() {
  return useMutation({
    mutationFn: (input: CreateFinancialAuthorizationInput) =>
      apiFetch<FinancialAuthorizationChallenge>('/financial-authorizations/challenge', {
        method: 'POST',
        body: input,
      }),
  });
}

export function useVerifyFinancialAuthorization() {
  return useMutation({
    mutationFn: (input: {
      authorizationId: string;
      payloadHash: string;
      assertion: Record<string, unknown>;
    }) =>
      apiFetch<{ authorizationId: string; verified: true }>('/financial-authorizations/verify', {
        method: 'POST',
        body: input,
      }),
  });
}
