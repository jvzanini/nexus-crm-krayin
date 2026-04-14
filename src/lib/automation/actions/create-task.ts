// TODO(fase-multi-tenant-strict): ver nota em update-field.ts sobre tenant scope.
// TODO(sistema-user): Activity.createdBy é NOT NULL. Quando automation cria task, não
// existe userId — usamos SYSTEM_USER_ID como placeholder. Fase futura deve seed um user
// "system" com este UUID fixo para consistência referencial.

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { ActionExecutor, CreateTaskParams } from "./types";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

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

export const createTaskExecutor: ActionExecutor<CreateTaskParams> = async (params, ctx) => {
  const subjectType = params.subjectType ?? "lead";
  const subjectId = params.subjectIdField
    ? resolveIdPath(ctx.payload, params.subjectIdField)
    : typeof (ctx.payload as Record<string, unknown>).id === "string"
      ? (ctx.payload as Record<string, unknown>).id as string
      : null;

  if (!subjectId) {
    return { ok: false, output: { error: "subject não resolvido" } };
  }

  const dueAt = params.dueInHours
    ? new Date(Date.now() + params.dueInHours * 60 * 60 * 1000)
    : null;

  try {
    const activity = await prisma.activity.create({
      data: {
        companyId: ctx.companyId,
        type: "task",
        status: "pending",
        subjectType,
        subjectId,
        title: params.title,
        dueAt,
        assignedTo: params.assignedTo ?? null,
        createdBy: params.assignedTo ?? SYSTEM_USER_ID,
      },
    });

    logger.info({ eventId: ctx.eventId, activityId: activity.id }, "automation.createTask.ok");
    return { ok: true, output: { activityId: activity.id } };
  } catch (err) {
    logger.error({ err, eventId: ctx.eventId }, "automation.createTask.failed");
    return { ok: false, output: { error: String((err as Error).message ?? err) } };
  }
};
