import { useQuery } from "@tanstack/react-query";
import type { AuditEvent } from "@credbridge/types";
import { apiFetch } from "./client";

export const auditQueryKeys = {
  byEntity: (entityId: string) => ["audit", entityId] as const,
  me: ["audit", "me"] as const,
};

interface UseAuditTrailOptions {
  pollMs?: number;
}

export function useAuditTrail(entityId: string, options: UseAuditTrailOptions = {}) {
  const { pollMs = 3000 } = options;
  return useQuery<AuditEvent[]>({
    queryKey: auditQueryKeys.byEntity(entityId),
    queryFn: () =>
      apiFetch<AuditEvent[]>(
        `/audit?entityId=${encodeURIComponent(entityId)}`,
      ),
    enabled: !!entityId,
    refetchInterval: pollMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useAuditLog() {
  return useQuery<AuditEvent[]>({
    queryKey: auditQueryKeys.me,
    queryFn: () => apiFetch<AuditEvent[]>("/audit"),
  });
}
