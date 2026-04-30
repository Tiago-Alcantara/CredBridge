import { useQuery } from "@tanstack/react-query";
import type { Receivable } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const receivableQueryKeys = {
  all: ["receivables"] as const,
  detail: (id: string) => ["receivables", id] as const,
};

export function useReceivables() {
  return useQuery<Receivable[]>({
    queryKey: receivableQueryKeys.all,
    queryFn: async () => {
      const response = await fetch(`${API_URL}/v1/receivables`);
      if (!response.ok) throw new Error("Erro ao buscar recebíveis");
      return response.json() as Promise<Receivable[]>;
    },
  });
}

export function useReceivable(id: string) {
  return useQuery<Receivable>({
    queryKey: receivableQueryKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/v1/receivables/${id}`);
      if (!response.ok) throw new Error("Recebível não encontrado");
      return response.json() as Promise<Receivable>;
    },
    enabled: !!id,
  });
}
