// Frente 17: tenant scope aplicado via ctx.companyId.
// Contact não possui campo assignedTo no schema atual — assign-user retorna skipped para esse tipo.

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { ActionExecutor, AssignUserParams } from "./types";

function resolveIdPath(obj: unknown, path: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : null;
}

export const assignUserExecutor: ActionExecutor<AssignUserParams> = async (params, ctx) => {
  const id = resolveIdPath(ctx.payload, params.idField);
  if (!id) {
    return { ok: false, output: { error: `idField "${params.idField}" não resolvido` } };
  }

  if (params.entityType === "contact") {
    // Contact não possui campo assignedTo no schema — skip gracioso
    return {
      ok: true,
      skipped: true,
      skipReason: "Contact não possui campo assignedTo",
      output: {},
    };
  }

  const data = { assignedTo: params.userId };
  let result: { count: number } | null = null;

  try {
    const where = { id, companyId: ctx.companyId };
    if (params.entityType === "lead") {
      result = await prisma.lead.updateMany({ where, data });
    } else {
      result = await prisma.opportunity.updateMany({ where, data });
    }

    if (!result || result.count === 0) {
      return { ok: false, output: { error: "Entity não encontrada" } };
    }

    logger.info(
      { eventId: ctx.eventId, entityType: params.entityType, id, userId: params.userId },
      "automation.assignUser.ok",
    );
    return { ok: true, output: { updated: result.count } };
  } catch (err) {
    logger.error({ err, eventId: ctx.eventId }, "automation.assignUser.failed");
    return { ok: false, output: { error: String((err as Error).message ?? err) } };
  }
};
