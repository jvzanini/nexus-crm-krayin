"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { getFileDriver, enforceMime, enforceSize } from "@/lib/files";
import { scheduleReminder, cancelReminder } from "@/lib/worker/queues/activity-reminders";
import { ActivityType, ActivityStatus, ActivitySubjectType } from "@/generated/prisma/enums";
import { randomUUID } from "crypto";
import { _schemas, createActivitySchema as _createSchema, updateActivitySchema as _updateSchema } from "./activities-schemas";

// ---------------------------------------------------------------------------
// Re-exports de enums (conveniente para consumidores)
// ---------------------------------------------------------------------------
export { ActivityType, ActivityStatus, ActivitySubjectType };

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ActivityFileItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface ActivityItem {
  id: string;
  companyId: string;
  type: ActivityType;
  status: ActivityStatus;
  subjectType: ActivitySubjectType;
  subjectId: string;
  title: string;
  description: string | null;
  scheduledAt: Date | null;
  timezone: string | null;
  durationMin: number | null;
  location: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  reminderAt: Date | null;
  reminderJobId: string | null;
  assignedTo: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  files: ActivityFileItem[];
}

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

async function resolveActiveCompanyId(userId: string): Promise<string | null> {
  const membership = await prisma.userCompanyMembership.findFirst({
    where: { userId, isActive: true },
    select: { companyId: true },
    orderBy: { createdAt: "asc" },
  });
  return membership?.companyId ?? null;
}

function handleError(err: unknown, fallback: string): ActionResult<never> {
  if (err instanceof PermissionDeniedError) {
    return { success: false, error: err.message };
  }
  logger.error({ err }, "activities.action.failed");
  return { success: false, error: fallback };
}

function serializeActivity(a: {
  id: string;
  companyId: string;
  type: ActivityType;
  status: ActivityStatus;
  subjectType: ActivitySubjectType;
  subjectId: string;
  title: string;
  description: string | null;
  scheduledAt: Date | null;
  timezone: string | null;
  durationMin: number | null;
  location: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  reminderAt: Date | null;
  reminderJobId: string | null;
  assignedTo: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  files: { id: string; filename: string; mimeType: string; size: number; createdAt: Date }[];
}): ActivityItem {
  return {
    id: a.id,
    companyId: a.companyId,
    type: a.type,
    status: a.status,
    subjectType: a.subjectType,
    subjectId: a.subjectId,
    title: a.title,
    description: a.description,
    scheduledAt: a.scheduledAt,
    timezone: a.timezone,
    durationMin: a.durationMin,
    location: a.location,
    dueAt: a.dueAt,
    completedAt: a.completedAt,
    reminderAt: a.reminderAt,
    reminderJobId: a.reminderJobId,
    assignedTo: a.assignedTo,
    createdBy: a.createdBy,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    files: a.files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      size: f.size,
      createdAt: f.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Schemas de validação (importados de activities-schemas — re-exportados)
// ---------------------------------------------------------------------------

export { _schemas, createActivitySchema, updateActivitySchema } from "./activities-schemas";

// ---------------------------------------------------------------------------
// Include padrão para queries
// ---------------------------------------------------------------------------

const activityInclude = {
  files: {
    select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listActivitiesForSubject(
  subjectType: "lead" | "contact" | "opportunity",
  subjectId: string,
  filter?: { type?: ActivityType; status?: ActivityStatus }
): Promise<ActionResult<ActivityItem[]>> {
  try {
    const user = await requirePermission("activities:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const where = {
      companyId,
      subjectType: subjectType as ActivitySubjectType,
      subjectId,
      ...(filter?.type && { type: filter.type }),
      ...(filter?.status && { status: filter.status }),
    };

    const activities = await prisma.activity.findMany({
      where,
      include: activityInclude,
      orderBy: [
        { scheduledAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    return { success: true, data: activities.map(serializeActivity) };
  } catch (err) {
    return handleError(err, "Erro ao listar atividades");
  }
}

export async function listMyTasks(filter?: {
  status?: ActivityStatus;
  dueWithinDays?: number;
}): Promise<ActionResult<ActivityItem[]>> {
  try {
    const user = await requirePermission("activities:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const where: {
      companyId: string;
      assignedTo: string;
      type: ActivityType;
      status?: ActivityStatus;
      dueAt?: { lte: Date };
    } = {
      companyId,
      assignedTo: user.id,
      type: "task" as ActivityType,
    };

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.dueWithinDays !== undefined) {
      const limit = new Date();
      limit.setDate(limit.getDate() + filter.dueWithinDays);
      where.dueAt = { lte: limit };
    }

    const activities = await prisma.activity.findMany({
      where,
      include: activityInclude,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });

    return { success: true, data: activities.map(serializeActivity) };
  } catch (err) {
    return handleError(err, "Erro ao listar tarefas");
  }
}

export async function getActivity(id: string): Promise<ActionResult<ActivityItem | null>> {
  try {
    const user = await requirePermission("activities:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: activityInclude,
    });

    if (!activity || activity.companyId !== companyId) {
      return { success: false, error: "Atividade não encontrada", data: null };
    }

    return { success: true, data: serializeActivity(activity) };
  } catch (err) {
    return handleError(err, "Erro ao buscar atividade");
  }
}

// ---------------------------------------------------------------------------
// Mutações
// ---------------------------------------------------------------------------

export async function createActivity(input: {
  type: string;
  subjectType: string;
  subjectId: string;
  title: string;
  description?: string;
  scheduledAt?: string;
  timezone?: string;
  durationMin?: number;
  location?: string;
  dueAt?: string;
  reminderAt?: string;
  assignedTo?: string;
}): Promise<ActionResult<ActivityItem>> {
  try {
    const user = await requirePermission("activities:create");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const parsed = _createSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const data = parsed.data;

    // Validar que o subject existe no tenant
    const subjectExists = await validateSubjectInTenant(data.subjectType, data.subjectId, companyId);
    if (!subjectExists) {
      return { success: false, error: "Assunto não encontrado" };
    }

    // Criar em transação: activity + agendar reminder se necessário
    const activity = await prisma.$transaction(async (tx) => {
      const created = await tx.activity.create({
        data: {
          companyId,
          type: data.type as ActivityType,
          status: "pending" as ActivityStatus,
          subjectType: data.subjectType as ActivitySubjectType,
          subjectId: data.subjectId,
          title: data.title,
          description: data.description ?? null,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          timezone: data.timezone ?? null,
          durationMin: data.durationMin ?? null,
          location: data.location ?? null,
          dueAt: data.dueAt ? new Date(data.dueAt) : null,
          reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
          assignedTo: data.assignedTo ?? null,
          createdBy: user.id,
        },
        include: activityInclude,
      });
      return created;
    });

    // Agendar reminder fora da transação
    if (data.reminderAt) {
      const jobId = await scheduleReminder({
        id: activity.id,
        reminderAt: new Date(data.reminderAt),
        assignedTo: data.assignedTo ?? null,
        createdBy: user.id,
        subjectType: data.subjectType,
        subjectId: data.subjectId,
        title: data.title,
      });
      if (jobId) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: { reminderJobId: jobId },
        });
        activity.reminderJobId = jobId;
      }
    }

    revalidatePath("/tasks");
    return { success: true, data: serializeActivity(activity) };
  } catch (err) {
    return handleError(err, "Erro ao criar atividade");
  }
}

export async function updateActivity(
  id: string,
  patch: {
    type?: string;
    title?: string;
    description?: string | null;
    scheduledAt?: string | null;
    timezone?: string | null;
    durationMin?: number | null;
    location?: string | null;
    dueAt?: string | null;
    reminderAt?: string | null;
    assignedTo?: string | null;
  }
): Promise<ActionResult<ActivityItem>> {
  try {
    const user = await requirePermission("activities:edit");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    // Verifica tenant-scope
    const existing = await prisma.activity.findUnique({
      where: { id },
      select: { id: true, companyId: true, reminderAt: true, reminderJobId: true },
    });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Atividade não encontrada" };
    }

    const parsed = _updateSchema.safeParse(patch);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const data = parsed.data;

    // Verificar se reminderAt mudou
    const newReminderAt = data.reminderAt !== undefined ? data.reminderAt : undefined;
    const reminderChanged = newReminderAt !== undefined;

    const updated = await prisma.activity.update({
      where: { id },
      data: {
        ...(data.type !== undefined && { type: data.type as ActivityType }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.scheduledAt !== undefined && {
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.durationMin !== undefined && { durationMin: data.durationMin }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.dueAt !== undefined && { dueAt: data.dueAt ? new Date(data.dueAt) : null }),
        ...(reminderChanged && {
          reminderAt: newReminderAt ? new Date(newReminderAt) : null,
        }),
        ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
      },
      include: activityInclude,
    });

    // Re-agendar reminder se mudou
    if (reminderChanged) {
      // Cancelar job antigo
      await cancelReminder(existing.reminderJobId);

      if (newReminderAt) {
        const jobId = await scheduleReminder({
          id: updated.id,
          reminderAt: new Date(newReminderAt),
          assignedTo: updated.assignedTo ?? null,
          createdBy: updated.createdBy,
          subjectType: updated.subjectType,
          subjectId: updated.subjectId,
          title: updated.title,
        });
        if (jobId) {
          await prisma.activity.update({
            where: { id },
            data: { reminderJobId: jobId },
          });
          updated.reminderJobId = jobId;
        } else {
          await prisma.activity.update({
            where: { id },
            data: { reminderJobId: null },
          });
          updated.reminderJobId = null;
        }
      } else {
        await prisma.activity.update({ where: { id }, data: { reminderJobId: null } });
        updated.reminderJobId = null;
      }
    }

    revalidatePath("/tasks");
    return { success: true, data: serializeActivity(updated) };
  } catch (err) {
    return handleError(err, "Erro ao atualizar atividade");
  }
}

export async function completeActivity(id: string): Promise<ActionResult<ActivityItem>> {
  try {
    const user = await requirePermission("activities:complete");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const existing = await prisma.activity.findUnique({
      where: { id },
      select: { companyId: true, reminderJobId: true },
    });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Atividade não encontrada" };
    }

    // Cancelar reminder
    await cancelReminder(existing.reminderJobId);

    const updated = await prisma.activity.update({
      where: { id },
      data: {
        status: "completed" as ActivityStatus,
        completedAt: new Date(),
        reminderJobId: null,
      },
      include: activityInclude,
    });

    revalidatePath("/tasks");
    return { success: true, data: serializeActivity(updated) };
  } catch (err) {
    return handleError(err, "Erro ao concluir atividade");
  }
}

export async function cancelActivity(id: string): Promise<ActionResult<ActivityItem>> {
  try {
    const user = await requirePermission("activities:edit");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const existing = await prisma.activity.findUnique({
      where: { id },
      select: { companyId: true, reminderJobId: true },
    });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Atividade não encontrada" };
    }

    await cancelReminder(existing.reminderJobId);

    const updated = await prisma.activity.update({
      where: { id },
      data: {
        status: "canceled" as ActivityStatus,
        reminderJobId: null,
      },
      include: activityInclude,
    });

    revalidatePath("/tasks");
    return { success: true, data: serializeActivity(updated) };
  } catch (err) {
    return handleError(err, "Erro ao cancelar atividade");
  }
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("activities:delete");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const existing = await prisma.activity.findUnique({
      where: { id },
      select: { companyId: true, reminderJobId: true },
      // Incluir files para deletar do storage
    });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Atividade não encontrada" };
    }

    // Cancelar reminder
    await cancelReminder(existing.reminderJobId);

    // Buscar files para deletar do storage (best-effort)
    const files = await prisma.activityFile.findMany({
      where: { activityId: id },
      select: { storageKey: true },
    });

    const driver = getFileDriver();
    for (const file of files) {
      try {
        await driver.delete(file.storageKey);
      } catch (fileErr) {
        logger.warn({ err: fileErr, storageKey: file.storageKey }, "activities.deleteFile.warn — file orphan, continuing");
      }
    }

    // Delete DB (cascade remove activity_files via FK)
    await prisma.activity.delete({ where: { id } });

    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao excluir atividade");
  }
}

// ---------------------------------------------------------------------------
// Upload / Download de arquivos
// ---------------------------------------------------------------------------

export async function uploadFile(
  activityId: string,
  file: { filename: string; mime: string; bytes: Buffer }
): Promise<ActionResult<ActivityFileItem>> {
  try {
    const user = await requirePermission("activities:edit");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    // Verificar que activity pertence ao tenant
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { companyId: true },
    });
    if (!activity || activity.companyId !== companyId) {
      return { success: false, error: "Atividade não encontrada" };
    }

    // Validar mime + size
    try {
      enforceMime(file.mime);
      enforceSize(file.bytes.length);
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }

    // Gerar storage key
    const fileId = randomUUID();
    const storageKey = `companies/${companyId}/files/${fileId}.bin`;

    // Gravar no driver
    const driver = getFileDriver();
    await driver.put(storageKey, file.bytes, file.mime);

    // Criar registro no DB
    const created = await prisma.activityFile.create({
      data: {
        activityId,
        storageKey,
        filename: file.filename,
        mimeType: file.mime,
        size: file.bytes.length,
        createdBy: user.id,
      },
    });

    return {
      success: true,
      data: {
        id: created.id,
        filename: created.filename,
        mimeType: created.mimeType,
        size: created.size,
        createdAt: created.createdAt,
      },
    };
  } catch (err) {
    return handleError(err, "Erro ao fazer upload do arquivo");
  }
}

export async function downloadFile(
  fileId: string
): Promise<ActionResult<{ filename: string; mime: string; stream: NodeJS.ReadableStream; size: number }>> {
  try {
    const user = await requirePermission("activities:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const file = await prisma.activityFile.findUnique({
      where: { id: fileId },
      include: {
        activity: { select: { companyId: true } },
      },
    });

    if (!file || file.activity.companyId !== companyId) {
      return { success: false, error: "Arquivo não encontrado" };
    }

    const driver = getFileDriver();
    const result = await driver.get(file.storageKey);

    return {
      success: true,
      data: {
        filename: file.filename,
        mime: file.mimeType,
        stream: result.stream,
        size: result.size,
      },
    };
  } catch (err) {
    return handleError(err, "Erro ao baixar arquivo");
  }
}

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

async function validateSubjectInTenant(
  subjectType: string,
  subjectId: string,
  companyId: string
): Promise<boolean> {
  switch (subjectType) {
    case "lead": {
      const row = await prisma.lead.findFirst({ where: { id: subjectId, companyId }, select: { id: true } });
      return row !== null;
    }
    case "contact": {
      const row = await prisma.contact.findFirst({ where: { id: subjectId, companyId }, select: { id: true } });
      return row !== null;
    }
    case "opportunity": {
      const row = await prisma.opportunity.findFirst({ where: { id: subjectId, companyId }, select: { id: true } });
      return row !== null;
    }
    default:
      return false;
  }
}
