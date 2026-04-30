import { useQuery } from "@tanstack/react-query";
import type { Settlement } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const settlementQueryKeys = {
  all: ["settlements"] as const,
  detail: (id: string) => ["settlements", id] as const,
};

export function useSettlements() {
  return useQuery<Settlement[]>({
    queryKey: settlementQueryKeys.all,
    queryFn: async () => {
      const response = await fetch(`${API_URL}/v1/settlements`);
      if (!response.ok) throw new Error("Erro ao buscar liquidações");
      return response.json() as Promise<Settlement[]>;
    },
  });
}
