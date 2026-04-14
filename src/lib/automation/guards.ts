import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { NotificationType } from "@/generated/prisma/client";

export const CHAIN_DEPTH_MAX = 10;
export const DEFAULT_DAILY_QUOTA = 10000;
export const CIRCUIT_BREAKER_WINDOW_MS = 60 * 60 * 1000; // 1h
export const CIRCUIT_BREAKER_MIN_SAMPLES = 20;
export const CIRCUIT_BREAKER_MAX_FAIL_RATIO = 0.5;

/** Aborta se chainDepth >= MAX. */
export function chainDepthExceeded(chainDepth: number): boolean {
  return chainDepth >= CHAIN_DEPTH_MAX;
}

function quotaKey(companyId: string, date = new Date()): string {
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `automation:quota:${companyId}:${yyyymmdd}`;
}

/**
 * Incrementa quota diária; se exceder, retorna over=true (e marca notification uma vez).
 * Fire-and-forget em caso de erro de Redis (degrade gracefully: permite execution).
 */
export async function incrementQuotaOrReject(
  companyId: string,
  limit = DEFAULT_DAILY_QUOTA,
): Promise<{ over: boolean; count: number }> {
  const key = quotaKey(companyId);
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // primeiro do dia — TTL 26h (folga para timezone)
      await redis.expire(key, 26 * 60 * 60);
    }
    if (count > limit) {
      await notifyQuotaExceededOnce(companyId, count);
      return { over: true, count };
    }
    return { over: false, count };
  } catch (err) {
    logger.warn({ err, companyId }, "automation.quota.redis_failed");
    return { over: false, count: 0 };
  }
}

async function notifyQuotaExceededOnce(companyId: string, count: number): Promise<void> {
  const flagKey = `automation:quota-notified:${companyId}:${new Date().toISOString().slice(0, 10)}`;
  try {
    const set = await redis.set(flagKey, "1", "EX", 26 * 60 * 60, "NX");
    if (set !== "OK") return; // já notificado hoje
    // Notifica admins do tenant (company_admin e super_admin)
    const admins = await prisma.userCompanyMembership.findMany({
      where: {
        companyId,
        role: { in: ["super_admin", "company_admin"] as any },
        isActive: true,
      },
      select: { userId: true },
    });
    for (const a of admins) {
      await createNotification({
        userId: a.userId,
        companyId,
        type: NotificationType.warning,
        title: "Cota diária de automation atingida",
        message: `Cota diária (${count}) excedida. Workflows com prioridade baixa podem ser pausados.`,
        link: "/automation/workflows",
      });
    }
  } catch (err) {
    logger.error({ err, companyId }, "automation.quota.notify_failed");
  }
}

/**
 * Avalia circuit breaker; se > thresholds, marca workflow paused + notifica admins.
 * Chamado *após* completar cada execution (success ou fail).
 */
export async function checkCircuitBreaker(workflowId: string): Promise<void> {
  try {
    const since = new Date(Date.now() - CIRCUIT_BREAKER_WINDOW_MS);
    const recent = await prisma.workflowExecution.findMany({
      where: { workflowId, startedAt: { gte: since } },
      select: { status: true },
    });
    if (recent.length < CIRCUIT_BREAKER_MIN_SAMPLES) return;
    const fails = recent.filter((r) => r.status === "failed").length;
    const ratio = fails / recent.length;
    if (ratio > CIRCUIT_BREAKER_MAX_FAIL_RATIO) {
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { status: "paused" },
      });
      const wf = await prisma.workflow.findUnique({ where: { id: workflowId } });
      if (wf) {
        const admins = await prisma.userCompanyMembership.findMany({
          where: {
            companyId: wf.companyId,
            role: { in: ["super_admin", "company_admin"] as any },
            isActive: true,
          },
          select: { userId: true },
        });
        for (const a of admins) {
          await createNotification({
            userId: a.userId,
            companyId: wf.companyId,
            type: NotificationType.error,
            title: `Workflow "${wf.name}" pausado automaticamente`,
            message: `Taxa de falha ${(ratio * 100).toFixed(0)}% em ${recent.length} execuções (última hora). Workflow pausado pelo circuit breaker.`,
            link: `/automation/workflows/${workflowId}`,
          });
        }
        logger.warn({ workflowId, ratio, samples: recent.length }, "automation.circuit_breaker.paused");
      }
    }
  } catch (err) {
    logger.error({ err, workflowId }, "automation.circuit_breaker.check_failed");
  }
}
