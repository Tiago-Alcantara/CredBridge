import { useQuery } from "@tanstack/react-query";
import type { AuditEvent } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const auditQueryKeys = {
  byEntity: (entityId: string) => ["audit", entityId] as const,
};

export function useAuditTrail(entityId: string) {
  return useQuery<AuditEvent[]>({
    queryKey: auditQueryKeys.byEntity(entityId),
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/v1/audit?entityId=${entityId}`
      );
      if (!response.ok) throw new Error("Erro ao buscar trilha de auditoria");
      return response.json() as Promise<AuditEvent[]>;
    },
    enabled: !!entityId,
  });
}
