import type { AuditPersist } from "@nexusai360/audit-log";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Persist callback para `@nexusai360/audit-log`. Grava cada entry via
 * `prisma.auditLog.create`. Normaliza `actorId` empty string → null para
 * respeitar FK opcional. Erros são apenas logados — não propagam para o
 * caller (fire-and-forget pelo pacote).
 */
export const auditPersist: AuditPersist = async (entry) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId || null,
        actorLabel: entry.actorLabel ?? "",
        companyId: entry.companyId ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        details: (entry.details ?? {}) as any,
        before: (entry.before ?? null) as any,
        after: (entry.after ?? null) as any,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.error(
      {
        err,
        action: entry.action,
        resourceType: entry.resourceType,
        companyId: entry.companyId,
      },
      "audit-log.create.failed",
    );
  }
};
