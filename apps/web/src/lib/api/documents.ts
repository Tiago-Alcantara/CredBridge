import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Document, RegisterDocumentInput } from "@credbridge/types";
import { apiFetch } from "./client";

export const documentQueryKeys = {
  byReceivable: (receivableId: string) =>
    ["documents", "receivable", receivableId] as const,
};

export function useDocumentsByReceivable(receivableId: string) {
  return useQuery<Document[]>({
    queryKey: documentQueryKeys.byReceivable(receivableId),
    queryFn: () =>
      apiFetch<Document[]>(`/receivables/${receivableId}/documents`),
    enabled: !!receivableId,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterDocumentInput) => {
      const { receivableId, ...rest } = input;
      return apiFetch<Document>(`/receivables/${receivableId}/documents`, {
        method: "POST",
        body: rest,
      });
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({
        queryKey: documentQueryKeys.byReceivable(input.receivableId),
      });
    },
  });
}
