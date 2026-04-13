"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ContactItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  title: string | null;
  notes: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getContacts(): Promise<ActionResult<ContactItem[]>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { success: true, data: contacts };
}

export async function createContact(data: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  organization?: string;
  title?: string;
  notes?: string;
  avatarUrl?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const contact = await prisma.contact.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      organization: data.organization ?? null,
      title: data.title ?? null,
      notes: data.notes ?? null,
      avatarUrl: data.avatarUrl ?? null,
    },
  });

  revalidatePath("/contacts");
  return { success: true, data: { id: contact.id } };
}

export async function updateContact(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    organization?: string;
    title?: string;
    notes?: string;
    avatarUrl?: string;
  }
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const updateData: Record<string, unknown> = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.organization !== undefined) updateData.organization = data.organization;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

  await prisma.contact.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/contacts");
  return { success: true };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  await prisma.contact.delete({ where: { id } });

  revalidatePath("/contacts");
  return { success: true };
}
