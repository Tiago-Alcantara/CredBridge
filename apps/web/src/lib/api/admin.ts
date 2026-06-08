import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Receivable } from "@credbridge/types";
import { apiFetch } from "./client";

export interface PendingTransaction {
  id: string;
  userId: string;
  amount: number;
  type: "DEPOSIT" | "WITHDRAWAL";
  status: "PENDING" | "APPROVED" | "REJECTED";
  txHash: string | null;
  approvedBy: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export const adminQueryKeys = {
  receivables: ["admin", "receivables", "pending"] as const,
  transactions: ["admin", "transactions", "pending"] as const,
  users: ["admin", "users"] as const,
};

export function usePendingReceivables() {
  return useQuery<Receivable[]>({
    queryKey: adminQueryKeys.receivables,
    queryFn: () => apiFetch<Receivable[]>("/admin/receivables/pending"),
  });
}

export function useApproveReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Receivable>(`/admin/receivables/${id}/approve`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.receivables });
    },
  });
}

export function useRejectReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Receivable>(`/admin/receivables/${id}/reject`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.receivables });
    },
  });
}

export function usePendingTransactions() {
  return useQuery<PendingTransaction[]>({
    queryKey: adminQueryKeys.transactions,
    queryFn: () => apiFetch<PendingTransaction[]>("/admin/transactions/pending"),
  });
}

export function useApproveTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: "APPROVED" | "REJECTED" }) =>
      apiFetch<PendingTransaction>(`/admin/transactions/${input.id}/approve`, {
        method: "POST",
        body: { status: input.status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.transactions });
    },
  });
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; amount: number }) =>
      apiFetch<PendingTransaction>("/pix/deposits", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.transactions });
    },
  });
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "pme" | "investor" | "operator" | null;
  cnpj: string | null;
  companyName: string | null;
  operationalLimit: number | null;
  stellarWalletId: string | null;
  privyStellarWalletAddress: string | null;
  createdAt: string;
}

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: adminQueryKeys.users,
    queryFn: () => apiFetch<AdminUser[]>("/admin/users"),
  });
}
