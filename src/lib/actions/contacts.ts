"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordConsent, maskIp } from "@/lib/consent";
import { z } from "zod";
import { dispatch } from "@/lib/automation/dispatcher";
import { logger } from "@/lib/logger";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";

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
  try {
    await requirePermission("contacts:view");

    let companyId: string;
    try {
      companyId = await requireActiveCompanyId();
    } catch {
      return { success: false, error: "Empresa ativa não encontrada" };
    }

    const contacts = await prisma.contact.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: contacts };
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }
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
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    user = await requirePermission("contacts:create");
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
        companyId,
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

  await dispatch("contact_created", {
    companyId,
    payload: {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      organization: contact.organization,
      title: contact.title,
    },
  }).catch((err) =>
    logger.warn({ err, contactId: contact.id }, "automation.dispatch.contact_created.failed")
  );

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
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    user = await requirePermission("contacts:edit");
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

  const result = await prisma.$transaction(async (tx) => {
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

    let count = 0;
    if (Object.keys(patch).length > 0) {
      const r = await tx.contact.updateMany({ where: { id, companyId }, data: patch });
      count = r.count;
    } else {
      const exists = await tx.contact.findFirst({ where: { id, companyId }, select: { id: true } });
      count = exists ? 1 : 0;
    }

    if (count === 0) return 0;

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
    return count;
  });

  if (result === 0) {
    return { success: false, error: "Contato não encontrado" };
  }

  revalidatePath("/contacts");
  return { success: true };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  try {
    await requirePermission("contacts:delete");
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

  const r = await prisma.contact.deleteMany({ where: { id, companyId } });
  if (r.count === 0) {
    return { success: false, error: "Contato não encontrado" };
  }

  revalidatePath("/contacts");
  return { success: true };
}
