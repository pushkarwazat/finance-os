import { AuditEvent } from "@financeos/shared";

export interface AuditLogger {
  log(event: Omit<AuditEvent, "id" | "timestamp">): Promise<AuditEvent>;
  query(filters: {
    actorId?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    since?: Date;
    until?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ events: AuditEvent[]; total: number }>;
}

export function buildAuditEvent(
  partial: Omit<AuditEvent, "id" | "timestamp">
): Omit<AuditEvent, "id"> {
  return {
    ...partial,
    timestamp: new Date().toISOString(),
  };
}
