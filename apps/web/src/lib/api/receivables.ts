import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Receivable, CreateReceivableInput, InvestorPoolStats } from "@credbridge/types";
import { apiFetch } from "./client";
import { auditQueryKeys } from "./audit";

export const receivableQueryKeys = {
  all: ["receivables"] as const,
  detail: (id: string) => ["receivables", id] as const,
};

export function useReceivables() {
  return useQuery<Receivable[]>({
    queryKey: receivableQueryKeys.all,
    queryFn: () => apiFetch<Receivable[]>("/receivables"),
  });
}

export function useReceivable(id: string) {
  return useQuery<Receivable>({
    queryKey: receivableQueryKeys.detail(id),
    queryFn: () => apiFetch<Receivable>(`/receivables/${id}`),
    enabled: !!id,
  });
}

export function useInvestorPool() {
  return useQuery<Receivable[]>({
    queryKey: ["receivables", "pool"],
    queryFn: () => apiFetch<Receivable[]>("/receivables/pool"),
  });
}

export function useInvestorStats() {
  return useQuery<InvestorPoolStats>({
    queryKey: ["receivables", "pool", "stats"],
    queryFn: () => apiFetch<InvestorPoolStats>("/receivables/pool/stats"),
  });
}

export function useCreateReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReceivableInput) =>
      apiFetch<Receivable>("/receivables", { method: "POST", body: input }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: receivableQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: auditQueryKeys.me });
      if (created?.id) {
        queryClient.invalidateQueries({ queryKey: auditQueryKeys.byEntity(created.id) });
      }
    },
  });
}

export function useActivateReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Receivable>(`/receivables/${id}/activate`, { method: "PATCH" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: receivableQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: auditQueryKeys.me });
      queryClient.invalidateQueries({ queryKey: auditQueryKeys.byEntity(id) });
    },
  });
}

export function useTokenizeReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Receivable>(`/receivables/${id}/tokenize`, { method: "PATCH" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: receivableQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: auditQueryKeys.me });
      queryClient.invalidateQueries({ queryKey: auditQueryKeys.byEntity(id) });
    },
  });
}

export function useAssignReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; authorizationId: string }) =>
      apiFetch<Receivable>(`/receivables/${input.id}/assign`, {
        method: "PATCH",
        body: { authorizationId: input.authorizationId },
      }),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: receivableQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: auditQueryKeys.me });
      queryClient.invalidateQueries({ queryKey: auditQueryKeys.byEntity(input.id) });
    },
  });
}
