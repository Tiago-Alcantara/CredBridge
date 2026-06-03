import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface Scaled {
  raw: string;
  value: number;
}

export interface PoolStatus {
  poolContractId: string;
  brltTokenId: string;
  shareTokenId: string;
  admin: string;
  operator: string;
  paused: boolean;
  brltDecimals: number;
  shareDecimals: number;
  nav: Scaled;
  cashBalance: Scaled;
  totalPrincipal: Scaled;
  totalShares: Scaled;
  sharePrice: { raw: string; value: number };
}

export interface InvestorShares {
  address: string;
  shares: Scaled;
  estimatedValueBrl: number;
}

export function usePoolStatus(enabled: boolean) {
  return useQuery<PoolStatus>({
    queryKey: ["operator", "pool", "status"],
    queryFn: () => apiFetch<PoolStatus>("/admin/pool/status"),
    staleTime: Infinity,
    enabled,
  });
}

export function useInvestorShares(address: string) {
  return useQuery<InvestorShares>({
    queryKey: ["operator", "pool", "shares", address],
    queryFn: () =>
      apiFetch<InvestorShares>(`/admin/pool/shares?address=${address}`),
    enabled: false,
  });
}
