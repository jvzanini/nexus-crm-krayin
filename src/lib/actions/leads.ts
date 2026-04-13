"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface LeadItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getLeads(): Promise<ActionResult<LeadItem[]>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { success: true, data: leads };
}

export async function createLead(data: {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status?: string;
  notes?: string;
  assignedTo?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const lead = await prisma.lead.create({
    data: {
      name: data.name,
      email: data.email ?? null,
      phone: data.phone ?? null,
      company: data.company ?? null,
      source: data.source ?? null,
      status: (data.status as any) ?? "new",
      notes: data.notes ?? null,
      assignedTo: data.assignedTo ?? null,
    },
  });

  revalidatePath("/leads");
  return { success: true, data: { id: lead.id } };
}

export async function updateLead(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: string;
    status?: string;
    notes?: string;
    assignedTo?: string;
  }
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.company !== undefined) updateData.company = data.company;
  if (data.source !== undefined) updateData.source = data.source;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;

  await prisma.lead.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/leads");
  return { success: true };
}

export async function deleteLead(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  await prisma.lead.delete({ where: { id } });

  revalidatePath("/leads");
  return { success: true };
}
