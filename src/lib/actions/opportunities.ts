"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { listCustomAttributes } from "@/lib/custom-attributes/list";
import { buildZodFromDefinitions } from "@/lib/custom-attributes/validator";
import { assertCustomBytes } from "@/lib/custom-attributes/limits";
import { parseP2002IndexName } from "@/lib/custom-attributes/p2002-parser";
import {
  buildPrismaWhereFromCustomFilters,
  type CustomFilter,
} from "@/lib/custom-attributes/query-builder";

/**
 * Valida payload `custom` contra definitions ativas e asserta 32KB cap.
 * Retorna o objeto validado (ou `null` se input for nulo/undefined).
 * Lança com mensagem amigável se falhar.
 */
async function validateOpportunityCustom(
  companyId: string,
  raw: Record<string, unknown> | undefined | null,
): Promise<Record<string, unknown> | null> {
  if (raw === undefined || raw === null) return null;
  const defs = await listCustomAttributes(companyId, "opportunity");
  const schema = buildZodFromDefinitions(defs);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`custom payload inválido: ${parsed.error.message}`);
  }
  assertCustomBytes(parsed.data);
  return parsed.data as Record<string, unknown>;
}

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
  /**
   * Filtros custom estruturados (cf[key][op]=value). O caller parseia a URL
   * via `parseCustomFiltersFromSearchParams` e passa a lista aqui.
   */
  custom?: Array<{ key: string; op: string; value: unknown }>;
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
    if (filters?.custom && filters.custom.length > 0) {
      const defs = await listCustomAttributes(companyId, "opportunity");
      const customWhere = buildPrismaWhereFromCustomFilters(
        filters.custom as CustomFilter[],
        defs,
      );
      if (customWhere) where.custom = customWhere;
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
  custom?: Record<string, unknown> | null;
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

  let customValidated: Record<string, unknown> | null = null;
  try {
    customValidated = await validateOpportunityCustom(companyId, data.custom);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "custom payload inválido",
    };
  }

  try {
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
        ...(customValidated !== null
          ? { custom: customValidated as never }
          : {}),
      },
    });

    revalidatePath("/opportunities");
    return { success: true, data: { id: opportunity.id } };
  } catch (err) {
    const p2002 = parseP2002IndexName(err);
    if (p2002 && p2002.entity === "opportunity") {
      return {
        success: false,
        error: `valor duplicado para campo unique "${p2002.key}"`,
      };
    }
    throw err;
  }
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
    custom?: Record<string, unknown> | null;
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

  if (data.custom !== undefined) {
    try {
      const validated = await validateOpportunityCustom(companyId, data.custom);
      if (validated !== null) {
        updateData.custom = validated;
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "custom payload inválido",
      };
    }
  }

  try {
    const r = await prisma.opportunity.updateMany({
      where: { id, companyId },
      data: updateData,
    });
    if (r.count === 0) {
      return { success: false, error: "Oportunidade não encontrada" };
    }

    revalidatePath("/opportunities");
    return { success: true };
  } catch (err) {
    const p2002 = parseP2002IndexName(err);
    if (p2002 && p2002.entity === "opportunity") {
      return {
        success: false,
        error: `valor duplicado para campo unique "${p2002.key}"`,
      };
    }
    throw err;
  }
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
