import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Receivable, CreateReceivableInput } from "@credbridge/types";
import { apiFetch } from "./client";

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

export function useCreateReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReceivableInput) =>
      apiFetch<Receivable>("/receivables", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: receivableQueryKeys.all });
    },
  });
}
