import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit-log";
import { ActorType } from "@/generated/prisma/client";
import {
  CUSTOM_ATTR_FINALIZE_DELETE_QUEUE,
  type FinalizeDeletePayload,
} from "../queues/custom-attr";

/**
 * T11.5/34 — processor finalize-delete.
 *
 * Último elo da cadeia delete: purge → [drop-index] → finalize.
 * Remove fisicamente a def (customAttribute) do DB e invalida o cache
 * `custom-attrs:{companyId}:{entity}` via revalidateTag(..., "max").
 *
 * Safety:
 * - def inexistente → no-op (log warn + `not_found`).
 * - def com status != "deleting" → no-op (log warn + `not_deleting`).
 *   Protege contra jobs enfileirados antes de a def ter sido marcada
 *   para deletar (evita apagar def ativa por acidente).
 */
export async function processFinalizeDelete(
  job: Job<FinalizeDeletePayload>,
): Promise<{ deleted: boolean; reason?: "not_found" | "not_deleting" }> {
  const { defId } = job.data;

  const def = await prisma.customAttribute.findUnique({
    where: { id: defId },
  });

  if (!def) {
    logger.warn(
      { jobId: job.id, defId },
      "custom-attr.finalize-delete: def não encontrada — no-op",
    );
    return { deleted: false, reason: "not_found" };
  }

  if (def.status !== "deleting") {
    logger.warn(
      { jobId: job.id, defId, status: def.status },
      "custom-attr.finalize-delete: def não está em status=deleting — no-op (safety)",
    );
    return { deleted: false, reason: "not_deleting" };
  }

  await prisma.customAttribute.delete({ where: { id: defId } });

  const { revalidateTag } = await import("next/cache");
  revalidateTag(`custom-attrs:${def.companyId}:${def.entity}`, "max");

  await auditLog({
    actorType: ActorType.system,
    actorLabel: "worker:custom-attr-finalize-delete",
    companyId: def.companyId,
    action: "deleted",
    resourceType: "custom_attribute",
    resourceId: defId,
    details: { entity: def.entity, key: def.key },
    after: { removed: [def.key] },
  });

  return { deleted: true };
}

export function startCustomAttrFinalizeDeleteWorker(): Worker {
  const worker = new Worker<FinalizeDeletePayload>(
    CUSTOM_ATTR_FINALIZE_DELETE_QUEUE,
    processFinalizeDelete,
    { connection: redis },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, err: err.message },
      "custom-attr.finalize-delete: job falhou",
    );
  });

  return worker;
}
