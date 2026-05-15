import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

interface WalletInfo {
  contractId: string;
  passkeyId: string | null;
}

interface CreateWalletInput {
  contractId: string;
  keyId: string;
}

export function useCreateWallet() {
  return useMutation({
    mutationFn: (input: CreateWalletInput) =>
      apiFetch<{ contractId: string }>('/wallet/create', {
        method: 'POST',
        body: input,
      }),
  });
}

export function useGetWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiFetch<WalletInfo | null>('/wallet'),
    staleTime: Infinity,
  });
}
