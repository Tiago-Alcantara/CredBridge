import { useQuery } from "@tanstack/react-query";
import type { Document } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const documentQueryKeys = {
  byReceivable: (receivableId: string) =>
    ["documents", "receivable", receivableId] as const,
};

export function useDocumentsByReceivable(receivableId: string) {
  return useQuery<Document[]>({
    queryKey: documentQueryKeys.byReceivable(receivableId),
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/v1/receivables/${receivableId}/documents`
      );
      if (!response.ok) throw new Error("Erro ao buscar documentos");
      return response.json() as Promise<Document[]>;
    },
    enabled: !!receivableId,
  });
}
