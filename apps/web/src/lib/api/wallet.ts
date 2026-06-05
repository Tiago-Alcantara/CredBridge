import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

interface WalletInfo {
  contractId: string;
  passkeyId: string | null;
  walletType: 'smart_account' | string | null;
  walletStatus: 'ready' | string | null;
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

export interface WalletBalance {
  address: string;
  tokenId: string;
  balance: { raw: string; value: number };
}

export const walletQueryKeys = {
  balance: ['wallet', 'balance'] as const,
};

export function useWalletBalance() {
  return useQuery<WalletBalance | null>({
    queryKey: walletQueryKeys.balance,
    queryFn: () => apiFetch<WalletBalance | null>('/wallet/balance'),
  });
}
