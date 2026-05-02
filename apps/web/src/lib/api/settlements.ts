import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Settlement, CreateSettlementInput } from "@credbridge/types";
import { apiFetch } from "./client";

export const settlementQueryKeys = {
  all: ["settlements"] as const,
  byReceivable: (receivableId: string) =>
    ["settlements", "receivable", receivableId] as const,
};

export function useSettlements() {
  return useQuery<Settlement[]>({
    queryKey: settlementQueryKeys.all,
    queryFn: () => apiFetch<Settlement[]>("/settlements"),
  });
}

export function useSettlementsByReceivable(receivableId: string) {
  return useQuery<Settlement[]>({
    queryKey: settlementQueryKeys.byReceivable(receivableId),
    queryFn: () =>
      apiFetch<Settlement[]>(`/settlements/receivable/${receivableId}`),
    enabled: !!receivableId,
  });
}

export function useCreateSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSettlementInput) =>
      apiFetch<Settlement>("/settlements", { method: "POST", body: input }),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: settlementQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: settlementQueryKeys.byReceivable(input.receivableId),
      });
    },
  });
}
