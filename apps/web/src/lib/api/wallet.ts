import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

interface WalletInfo {
  contractId: string;
  passkeyId: string | null;
  walletType: 'smart_account' | string | null;
  walletStatus: 'ready' | string | null;
}

interface WalletXlmBalance {
  walletAddress: string | null;
  xlmBalance: number;
}

export function fetchWalletXlmBalance(): Promise<WalletXlmBalance> {
  return apiFetch<WalletXlmBalance>('/wallet/xlm-balance');
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

export function useGetWalletXlmBalance(enabled = true) {
  return useQuery({
    queryKey: ['wallet', 'xlm-balance'],
    queryFn: fetchWalletXlmBalance,
    staleTime: 30_000,
    retry: false,
    enabled,
  });
}
