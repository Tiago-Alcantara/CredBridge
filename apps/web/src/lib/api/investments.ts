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

export interface InvestorTransaction {
  id: string;
  userId: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  status: "PENDING_PAYMENT" | "PAYMENT_SUBMITTED" | "APPROVED" | "COMPLETED" | "REJECTED";
  txHash: string | null;
  pixQrCodePayload?: string | null;
  pixQrCodeLocation?: string | null;
  pixQrCodeBase64?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useInvestorTransactions() {
  return useQuery<InvestorTransaction[]>({
    queryKey: ["investments", "me", "transactions"],
    queryFn: () => apiFetch<InvestorTransaction[]>("/investments/me/transactions"),
  });
}

export function useNotifyDepositPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<InvestorTransaction>(`/investments/deposit/${id}/pay`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments", "me", "transactions"] });
    },
  });
}

export interface UnsignedSorobanTx {
  xdr: string;
  hashToSign: string;
  signerPublicKey: string;
}

export type DepositStage = "approve" | "deposit";

export function buildDepositStage(id: string, stage: DepositStage) {
  return apiFetch<UnsignedSorobanTx>(`/investments/deposit/${id}/onchain/build`, {
    method: "POST",
    body: { stage },
  });
}

export function submitDepositStage(
  id: string,
  stage: DepositStage,
  xdr: string,
  signature: string,
) {
  return apiFetch<{ hash: string; status: string }>(
    `/investments/deposit/${id}/onchain/submit`,
    { method: "POST", body: { stage, xdr, signature } },
  );
}
