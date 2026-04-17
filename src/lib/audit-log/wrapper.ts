// Audit Log — wrapper async sobre @nexusai360/audit-log
import { logAudit, type AuditEntry } from "@nexusai360/audit-log";
import { ActorType } from "@/generated/prisma/client";

export interface AuditInput {
  actorType: ActorType;
  actorId?: string;
  actorLabel: string;
  companyId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Wrapper async para retrocompat com callers existentes.
 * Internamente delega ao logAudit (sync, fire-and-forget) do
 * `@nexusai360/audit-log`. Callers continuam podendo `await` (no-op instantâneo).
 *
 * Importante: erros do persist NÃO propagam mais para o caller —
 * vão para o logger configurado em `lib/audit-log/persist.ts`.
 */
export async function auditLog(input: AuditInput): Promise<void> {
  const entry: AuditEntry = {
    actorType: input.actorType,
    actorId: input.actorId ?? "",
    actorLabel: input.actorLabel,
    companyId: input.companyId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    details: input.details,
    before: input.before,
    after: input.after,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  };
  logAudit(entry);
}
