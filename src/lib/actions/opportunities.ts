"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { requireActiveCompanyId } from "@/lib/tenant-scope";

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

export async function getOpportunities(): Promise<ActionResult<OpportunityItem[]>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  let companyId: string;
  try {
    companyId = await requireActiveCompanyId();
  } catch {
    return { success: false, error: "Empresa ativa não encontrada" };
  }

  const opportunities = await prisma.opportunity.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: {
      contact: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  return { success: true, data: opportunities };
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
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

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
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

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
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

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
