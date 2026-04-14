// TODO(fase-multi-tenant-strict): Lead/Contact/Opportunity ainda não têm companyId
// diretamente no DB; tenant scope é reforçado em Server Actions (via session). Automation
// executor roda no worker sem session — atualmente confia que eventos foram disparados
// com companyId correto (invariante do dispatcher).

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { ActionExecutor, UpdateFieldParams } from "./types";

function resolveFieldPath(obj: unknown, path: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : null;
}

export const updateFieldExecutor: ActionExecutor<UpdateFieldParams> = async (params, ctx) => {
  const id = resolveFieldPath(ctx.payload, params.idField);
  if (!id) {
    return { ok: false, output: { error: `idField "${params.idField}" não resolvido no payload` } };
  }

  const data = { [params.field]: params.value } as Record<string, unknown>;

  try {
    let result: { count: number } | null = null;
    if (params.entityType === "lead") {
      result = await prisma.lead.updateMany({ where: { id }, data });
    } else if (params.entityType === "contact") {
      result = await prisma.contact.updateMany({ where: { id }, data });
    } else {
      result = await prisma.opportunity.updateMany({ where: { id }, data });
    }
    if (!result || result.count === 0) {
      return { ok: false, output: { error: "Entity não encontrada ou sem permissão" } };
    }
    logger.info(
      { eventId: ctx.eventId, entityType: params.entityType, id, field: params.field },
      "automation.updateField.ok",
    );
    return { ok: true, output: { updated: result.count, id, field: params.field } };
  } catch (err) {
    logger.error({ err, eventId: ctx.eventId }, "automation.updateField.failed");
    return { ok: false, output: { error: String((err as Error).message ?? err) } };
  }
};
