export type AuditEntityType = 'receivable' | 'document' | 'settlement' | 'user';

export interface AuditEvent {
  id: string;
  event: string;
  entityId: string;
  entityType: AuditEntityType;
  userId: string;
  txHash?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
