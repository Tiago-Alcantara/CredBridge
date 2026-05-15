import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWalletInput) =>
      apiFetch<{ contractId: string }>('/wallet/create', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}

export function useGetWallet(enabled = true) {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiFetch<WalletInfo | null>('/wallet'),
    staleTime: Infinity,
    retry: false,
    enabled,
  });
}
