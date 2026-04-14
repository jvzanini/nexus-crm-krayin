// Audit Log — fire-and-forget helper
import { prisma } from "@/lib/prisma";
import { ActorType } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

interface AuditInput {
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
 * Registra uma ação no audit log. Fire-and-forget — não lança exceção.
 */
export async function auditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel,
        companyId: input.companyId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        details: (input.details ?? {}) as any,
        before: (input.before ?? null) as any,
        after: (input.after ?? null) as any,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, action: input.action, resourceType: input.resourceType }, "audit-log.create.failed");
  }
}
