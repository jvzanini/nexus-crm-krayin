"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  setWorkflowStatusSchema,
} from "./workflows-schemas";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface Condition {
  field: string;
  op: "eq" | "neq" | "in" | "gt" | "lt" | "contains";
  value: unknown;
}

export interface ActionSpec {
  type: "update-field" | "create-task" | "assign-user" | "send-email";
  params: Record<string, unknown>;
}

export interface WorkflowItem {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  trigger: "lead_created" | "contact_created" | "activity_completed";
  conditions: Condition[];
  actions: ActionSpec[];
  status: "draft" | "active" | "paused";
  version: number;
  lastEditBy: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  logger.error({ err }, "workflows.action.failed");
  return { success: false, error: fallback };
}

function serializeWorkflow(w: {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  trigger: "lead_created" | "contact_created" | "activity_completed";
  conditions: unknown;
  actions: unknown;
  status: "draft" | "active" | "paused";
  version: number;
  lastEditBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkflowItem {
  return {
    id: w.id,
    companyId: w.companyId,
    name: w.name,
    description: w.description,
    trigger: w.trigger,
    conditions: (w.conditions as unknown as Condition[]) ?? [],
    actions: (w.actions as unknown as ActionSpec[]) ?? [],
    status: w.status,
    version: w.version,
    lastEditBy: w.lastEditBy,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listWorkflowsAction(): Promise<ActionResult<WorkflowItem[]>> {
  try {
    const user = await requirePermission("workflows:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const workflows = await prisma.workflow.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: workflows.map(serializeWorkflow) };
  } catch (err) {
    return handleError(err, "Erro ao listar workflows");
  }
}

export async function getWorkflowAction(id: string): Promise<ActionResult<WorkflowItem | null>> {
  try {
    const user = await requirePermission("workflows:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow || workflow.companyId !== companyId) {
      return { success: false, error: "Workflow não encontrado", data: null };
    }

    return { success: true, data: serializeWorkflow(workflow) };
  } catch (err) {
    return handleError(err, "Erro ao buscar workflow");
  }
}

// ---------------------------------------------------------------------------
// Mutações
// ---------------------------------------------------------------------------

export async function createWorkflowAction(input: {
  name: string;
  description?: string;
  trigger: string;
  conditions: unknown[];
  actions: unknown[];
  status?: string;
}): Promise<ActionResult<WorkflowItem>> {
  try {
    const user = await requirePermission("workflows:manage");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const parsed = createWorkflowSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const { name, description, trigger, conditions, actions, status } = parsed.data;

    const workflow = await prisma.workflow.create({
      data: {
        companyId,
        name,
        description: description ?? null,
        trigger,
        conditions: conditions as object[],
        actions: actions as object[],
        status: status ?? "draft",
        version: 1,
        lastEditBy: user.id,
      },
    });

    revalidatePath("/automation/workflows");
    return { success: true, data: serializeWorkflow(workflow) };
  } catch (err) {
    return handleError(err, "Erro ao criar workflow");
  }
}

export async function updateWorkflowAction(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    trigger?: string;
    conditions?: unknown[];
    actions?: unknown[];
  },
): Promise<ActionResult<WorkflowItem>> {
  try {
    const user = await requirePermission("workflows:manage");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const existing = await prisma.workflow.findUnique({ where: { id }, select: { id: true, companyId: true, version: true } });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Workflow não encontrado" };
    }

    const parsed = updateWorkflowSchema.safeParse(patch);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const data = parsed.data;

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.trigger !== undefined && { trigger: data.trigger }),
        ...(data.conditions !== undefined && { conditions: data.conditions as object[] }),
        ...(data.actions !== undefined && { actions: data.actions as object[] }),
        version: existing.version + 1,
        lastEditBy: user.id,
      },
    });

    revalidatePath("/automation/workflows");
    return { success: true, data: serializeWorkflow(updated) };
  } catch (err) {
    return handleError(err, "Erro ao atualizar workflow");
  }
}

export async function setWorkflowStatusAction(
  id: string,
  status: string,
): Promise<ActionResult<WorkflowItem>> {
  try {
    const user = await requirePermission("workflows:manage");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const existing = await prisma.workflow.findUnique({ where: { id }, select: { id: true, companyId: true, version: true } });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Workflow não encontrado" };
    }

    const parsed = setWorkflowStatusSchema.safeParse({ status });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Status inválido" };
    }

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        status: parsed.data.status,
        lastEditBy: user.id,
      },
    });

    revalidatePath("/automation/workflows");
    return { success: true, data: serializeWorkflow(updated) };
  } catch (err) {
    return handleError(err, "Erro ao atualizar status do workflow");
  }
}

export async function deleteWorkflowAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("workflows:manage");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const existing = await prisma.workflow.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Workflow não encontrado" };
    }

    await prisma.workflow.delete({ where: { id } });

    revalidatePath("/automation/workflows");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao excluir workflow");
  }
}

export async function deleteWorkflowsBulkAction(
  ids: string[],
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const user = await requirePermission("workflows:manage");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false, error: "Nenhum workflow selecionado" };
    }
    if (ids.length > 500) {
      return { success: false, error: "Limite de 500 itens por operação" };
    }

    // WorkflowExecution -> Workflow é onDelete Cascade; excluir é seguro.
    const result = await prisma.workflow.deleteMany({
      where: { id: { in: ids }, companyId },
    });

    revalidatePath("/automation/workflows");
    return { success: true, data: { deletedCount: result.count } };
  } catch (err) {
    return handleError(err, "Erro ao excluir workflows em massa");
  }
}
