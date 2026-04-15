"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";

export interface OpportunityItem {
  id: string;
  title: string;
  contactId: string | null;
  stage: string;
  value: number | null;
  currency: string;
  probability: number | null;
  closeDate: Date | null;
  notes: string | null;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
  contact: {
    firstName: string;
    lastName: string;
  } | null;
}

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export interface OpportunitiesFilters {
  stage?: string;
  minValue?: string;
  maxValue?: string;
  from?: string;
  to?: string;
}

const VALID_OPP_STAGES = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export async function getOpportunities(
  filters?: OpportunitiesFilters
): Promise<ActionResult<OpportunityItem[]>> {
  try {
    await requirePermission("opportunities:view");

    let companyId: string;
    try {
      companyId = await requireActiveCompanyId();
    } catch {
      return { success: false, error: "Empresa ativa não encontrada" };
    }

    const where: Record<string, unknown> = { companyId };
    if (
      filters?.stage &&
      (VALID_OPP_STAGES as readonly string[]).includes(filters.stage)
    ) {
      where.stage = filters.stage;
    }
    if (filters?.minValue || filters?.maxValue) {
      const range: Record<string, number> = {};
      if (filters.minValue) {
        const n = Number(filters.minValue);
        if (!isNaN(n)) range.gte = n;
      }
      if (filters.maxValue) {
        const n = Number(filters.maxValue);
        if (!isNaN(n)) range.lte = n;
      }
      if (Object.keys(range).length > 0) where.value = range;
    }
    if (filters?.from || filters?.to) {
      const range: Record<string, Date> = {};
      if (filters.from) {
        const d = new Date(filters.from);
        if (!isNaN(d.getTime())) range.gte = d;
      }
      if (filters.to) {
        const d = new Date(filters.to);
        if (!isNaN(d.getTime())) range.lte = d;
      }
      if (Object.keys(range).length > 0) where.createdAt = range;
    }

    const opportunities = await prisma.opportunity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        contact: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    return { success: true, data: opportunities };
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }
}

export async function deleteOpportunitiesBulk(
  ids: string[]
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    await requirePermission("opportunities:delete");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  let companyId: string;
  try {
    companyId = await requireActiveCompanyId();
  } catch {
    return { success: false, error: "Empresa ativa não encontrada" };
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: "Nenhum id fornecido" };
  }

  const r = await prisma.opportunity.deleteMany({
    where: { id: { in: ids }, companyId },
  });

  revalidatePath("/opportunities");
  return { success: true, data: { deletedCount: r.count } };
}

export async function updateOpportunitiesStageBulk(
  ids: string[],
  stage: string,
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    await requirePermission("opportunities:edit");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  let companyId: string;
  try {
    companyId = await requireActiveCompanyId();
  } catch {
    return { success: false, error: "Empresa ativa não encontrada" };
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: "Nenhum id fornecido" };
  }
  if (ids.length > 500) {
    return { success: false, error: "Limite de 500 itens por operação" };
  }
  if (!(VALID_OPP_STAGES as readonly string[]).includes(stage)) {
    return { success: false, error: "Stage inválido" };
  }

  const r = await prisma.opportunity.updateMany({
    where: { id: { in: ids }, companyId },
    data: { stage: stage as typeof VALID_OPP_STAGES[number] },
  });

  revalidatePath("/opportunities");
  return { success: true, data: { updatedCount: r.count } };
}

export async function assignOpportunitiesBulk(
  ids: string[],
  assigneeId: string | null,
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    await requirePermission("opportunities:edit");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  let companyId: string;
  try {
    companyId = await requireActiveCompanyId();
  } catch {
    return { success: false, error: "Empresa ativa não encontrada" };
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: "Nenhum id fornecido" };
  }
  if (ids.length > 500) {
    return { success: false, error: "Limite de 500 itens por operação" };
  }

  if (assigneeId) {
    const member = await prisma.userCompanyMembership.findFirst({
      where: { userId: assigneeId, companyId, isActive: true },
      select: { userId: true },
    });
    if (!member) {
      return { success: false, error: "Usuário não é membro ativo da empresa" };
    }
  }

  const r = await prisma.opportunity.updateMany({
    where: { id: { in: ids }, companyId },
    data: { assignedTo: assigneeId },
  });

  revalidatePath("/opportunities");
  return { success: true, data: { updatedCount: r.count } };
}

export async function createOpportunity(data: {
  title: string;
  contactId?: string;
  stage?: string;
  value?: number;
  currency?: string;
  probability?: number;
  closeDate?: string;
  notes?: string;
  assignedTo?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("opportunities:create");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  let companyId: string;
  try {
    companyId = await requireActiveCompanyId();
  } catch {
    return { success: false, error: "Empresa ativa não encontrada" };
  }

  // Se contactId for passado, valida que pertence ao mesmo tenant (evita FK cross-tenant).
  if (data.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: data.contactId, companyId },
      select: { id: true },
    });
    if (!contact) {
      return { success: false, error: "Contato não encontrado" };
    }
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      companyId,
      title: data.title,
      contactId: data.contactId ?? null,
      stage: (data.stage as any) ?? "prospecting",
      value: data.value ?? null,
      currency: data.currency ?? "BRL",
      probability: data.probability ?? 0,
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
      notes: data.notes ?? null,
      assignedTo: data.assignedTo ?? null,
    },
  });

  revalidatePath("/opportunities");
  return { success: true, data: { id: opportunity.id } };
}

export async function updateOpportunity(
  id: string,
  data: {
    title?: string;
    contactId?: string;
    stage?: string;
    value?: number;
    currency?: string;
    probability?: number;
    closeDate?: string;
    notes?: string;
    assignedTo?: string;
  }
): Promise<ActionResult> {
  try {
    await requirePermission("opportunities:edit");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  let companyId: string;
  try {
    companyId = await requireActiveCompanyId();
  } catch {
    return { success: false, error: "Empresa ativa não encontrada" };
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.contactId !== undefined) updateData.contactId = data.contactId;
  if (data.stage !== undefined) updateData.stage = data.stage;
  if (data.value !== undefined) updateData.value = data.value;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.probability !== undefined) updateData.probability = data.probability;
  if (data.closeDate !== undefined)
    updateData.closeDate = data.closeDate ? new Date(data.closeDate) : null;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;

  if (data.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: data.contactId, companyId },
      select: { id: true },
    });
    if (!contact) {
      return { success: false, error: "Contato não encontrado" };
    }
  }

  const r = await prisma.opportunity.updateMany({
    where: { id, companyId },
    data: updateData,
  });
  if (r.count === 0) {
    return { success: false, error: "Oportunidade não encontrada" };
  }

  revalidatePath("/opportunities");
  return { success: true };
}

export async function deleteOpportunity(id: string): Promise<ActionResult> {
  try {
    await requirePermission("opportunities:delete");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  let companyId: string;
  try {
    companyId = await requireActiveCompanyId();
  } catch {
    return { success: false, error: "Empresa ativa não encontrada" };
  }

  const r = await prisma.opportunity.deleteMany({ where: { id, companyId } });
  if (r.count === 0) {
    return { success: false, error: "Oportunidade não encontrada" };
  }

  revalidatePath("/opportunities");
  return { success: true };
}
