import { useQuery } from "@tanstack/react-query";
import type { AuditEvent } from "@credbridge/types";
import { apiFetch } from "./client";

export const auditQueryKeys = {
  byEntity: (entityId: string) => ["audit", entityId] as const,
};

export function useAuditTrail(entityId: string) {
  return useQuery<AuditEvent[]>({
    queryKey: auditQueryKeys.byEntity(entityId),
    queryFn: () =>
      apiFetch<AuditEvent[]>(
        `/audit?entityId=${encodeURIComponent(entityId)}`,
      ),
    enabled: !!entityId,
  });
}
