"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordConsent, maskIp } from "@/lib/consent";
import { z } from "zod";

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
  consentMarketing: boolean;
  consentTracking: boolean;
}

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

const consentSchema = z.object({
  marketing: z.boolean(),
  tracking: z.boolean(),
});

const contactFieldsSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  organization: z.string().nullish(),
  title: z.string().nullish(),
  notes: z.string().nullish(),
  avatarUrl: z.string().nullish(),
});

const createContactSchema = z.object({
  fields: contactFieldsSchema,
  consent: consentSchema,
});

const updateContactSchema = z.object({
  fields: contactFieldsSchema.partial(),
  consent: consentSchema.optional(),
});

async function resolveRequestContext() {
  const h = await headers();
  const xff = h.get("x-forwarded-for") ?? "";
  const ipRaw = xff.split(",")[0]?.trim() ?? "";
  const ipMask = maskIp(ipRaw);
  const ua = (h.get("user-agent") ?? "").slice(0, 200) || null;
  return { ipMask, ua };
}

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
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  title?: string | null;
  notes?: string | null;
  avatarUrl?: string | null;
  consent: { marketing: boolean; tracking: boolean };
}): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const parsed = createContactSchema.safeParse({
    fields: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      organization: data.organization,
      title: data.title,
      notes: data.notes,
      avatarUrl: data.avatarUrl,
    },
    consent: data.consent,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { ipMask, ua } = await resolveRequestContext();

  const contact = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const created = await tx.contact.create({
      data: {
        firstName: parsed.data.fields.firstName,
        lastName: parsed.data.fields.lastName,
        email: parsed.data.fields.email ?? null,
        phone: parsed.data.fields.phone ?? null,
        organization: parsed.data.fields.organization ?? null,
        title: parsed.data.fields.title ?? null,
        notes: parsed.data.fields.notes ?? null,
        avatarUrl: parsed.data.fields.avatarUrl ?? null,
        consentMarketing: parsed.data.consent.marketing,
        consentMarketingAt: parsed.data.consent.marketing ? now : null,
        consentMarketingIpMask: parsed.data.consent.marketing ? ipMask : null,
        consentTracking: parsed.data.consent.tracking,
        consentTrackingAt: parsed.data.consent.tracking ? now : null,
        consentTrackingIpMask: parsed.data.consent.tracking ? ipMask : null,
      },
    });
    await recordConsent(tx, {
      subjectType: "contact",
      subjectId: created.id,
      consent: parsed.data.consent,
      source: "contact_form",
      ipMask,
      userAgent: ua,
      grantedBy: user.id,
    });
    return created;
  });

  revalidatePath("/contacts");
  return { success: true, data: { id: contact.id } };
}

export async function updateContact(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    phone?: string | null;
    organization?: string | null;
    title?: string | null;
    notes?: string | null;
    avatarUrl?: string | null;
    consent?: { marketing: boolean; tracking: boolean };
  }
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const parsed = updateContactSchema.safeParse({
    fields: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      organization: data.organization,
      title: data.title,
      notes: data.notes,
      avatarUrl: data.avatarUrl,
    },
    consent: data.consent,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { ipMask, ua } = await resolveRequestContext();

  await prisma.$transaction(async (tx) => {
    const patch: Record<string, unknown> = {};
    const f = parsed.data.fields;
    if (f.firstName !== undefined) patch.firstName = f.firstName;
    if (f.lastName !== undefined) patch.lastName = f.lastName;
    if (f.email !== undefined) patch.email = f.email ?? null;
    if (f.phone !== undefined) patch.phone = f.phone ?? null;
    if (f.organization !== undefined) patch.organization = f.organization ?? null;
    if (f.title !== undefined) patch.title = f.title ?? null;
    if (f.notes !== undefined) patch.notes = f.notes ?? null;
    if (f.avatarUrl !== undefined) patch.avatarUrl = f.avatarUrl ?? null;

    if (Object.keys(patch).length > 0) {
      await tx.contact.update({ where: { id }, data: patch });
    }

    if (parsed.data.consent) {
      await recordConsent(tx, {
        subjectType: "contact",
        subjectId: id,
        consent: parsed.data.consent,
        source: "admin_edit",
        ipMask,
        userAgent: ua,
        grantedBy: user.id,
      });
    }
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
