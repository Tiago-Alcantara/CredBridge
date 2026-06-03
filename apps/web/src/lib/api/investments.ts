import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Investment,
  CreateInvestmentInput,
  InvestorPositionStats,
} from "@credbridge/types";
import { apiFetch } from "./client";

export const investmentQueryKeys = {
  mine: ["investments", "me"] as const,
  myStats: ["investments", "me", "stats"] as const,
};

export function useInvestorPositions() {
  return useQuery<Investment[]>({
    queryKey: investmentQueryKeys.mine,
    queryFn: () => apiFetch<Investment[]>("/investments/me"),
  });
}

export function useInvestorPositionStats() {
  return useQuery<InvestorPositionStats>({
    queryKey: investmentQueryKeys.myStats,
    queryFn: () => apiFetch<InvestorPositionStats>("/investments/me/stats"),
  });
}

export function useBuyReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvestmentInput) =>
      apiFetch<Investment>("/investments", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receivables", "pool"] });
      qc.invalidateQueries({ queryKey: ["receivables", "pool", "stats"] });
      qc.invalidateQueries({ queryKey: investmentQueryKeys.mine });
      qc.invalidateQueries({ queryKey: investmentQueryKeys.myStats });
    },
  });
}
