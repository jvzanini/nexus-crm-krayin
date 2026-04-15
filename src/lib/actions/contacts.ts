"use server";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordConsent, maskIp } from "@/lib/consent";
import { z } from "zod";
import { dispatch } from "@/lib/automation/dispatcher";
import { logger } from "@/lib/logger";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { listCustomAttributes } from "@/lib/custom-attributes/list";
import { buildZodFromDefinitions } from "@/lib/custom-attributes/validator";
import {
  assertCustomBytes,
  CustomAttrBytesExceededError,
  CustomAttrReservedKeyError,
} from "@/lib/custom-attributes/limits";
import { parseP2002IndexName } from "@/lib/custom-attributes/p2002-parser";
import {
  buildPrismaWhereFromCustomFilters,
  type CustomFilter,
} from "@/lib/custom-attributes/query-builder";

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

export interface ContactsFilters {
  q?: string;
  from?: string;
  to?: string;
  /** Filtros dinâmicos sobre a coluna `custom` (spec v3 §3.4/§3.6). */
  cfFilters?: CustomFilter[];
}

/**
 * Valida `custom` contra definitions ativas do tenant/entity=contact.
 * Retorna `{ ok: true, value, defs }` ou `{ ok: false, error }` para ActionResult.
 */
async function validateContactCustom(
  companyId: string,
  custom: Record<string, unknown> | undefined,
): Promise<
  | {
      ok: true;
      value: Record<string, unknown>;
      defs: Awaited<ReturnType<typeof listCustomAttributes>>;
    }
  | { ok: false; error: string }
> {
  const defs = await listCustomAttributes(companyId, "contact");
  const payload = custom ?? {};
  try {
    const schema = buildZodFromDefinitions(defs);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Campos customizados inválidos",
      };
    }
    assertCustomBytes(parsed.data);
    return { ok: true, value: parsed.data, defs };
  } catch (err) {
    if (err instanceof CustomAttrReservedKeyError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof CustomAttrBytesExceededError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

/**
 * Traduz erro Prisma P2002 em índice `idx_contacts_custom_<key>_unique` para
 * mensagem amigável "Valor duplicado em <label>".
 * Retorna `null` se o erro não matcha o padrão.
 */
function translateP2002Contact(
  err: unknown,
  defs: Awaited<ReturnType<typeof listCustomAttributes>>,
): string | null {
  const parsed = parseP2002IndexName(err);
  if (!parsed || parsed.entity !== "contact") return null;
  const def = defs.find((d) => d.key === parsed.key);
  const label = def?.label ?? parsed.key;
  return `Valor duplicado em ${label}`;
}

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

export async function getContacts(
  filters?: ContactsFilters
): Promise<ActionResult<ContactItem[]>> {
  try {
    await requirePermission("contacts:view");

    let companyId: string;
    try {
      companyId = await requireActiveCompanyId();
    } catch {
      return { success: false, error: "Empresa ativa não encontrada" };
    }

    const where: Record<string, unknown> = { companyId };
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
    if (filters?.q) {
      where.OR = [
        { firstName: { contains: filters.q, mode: "insensitive" } },
        { lastName: { contains: filters.q, mode: "insensitive" } },
        { email: { contains: filters.q, mode: "insensitive" } },
        { organization: { contains: filters.q, mode: "insensitive" } },
      ];
    }

    if (filters?.cfFilters && filters.cfFilters.length > 0) {
      const defs = await listCustomAttributes(companyId, "contact");
      const customWhere = buildPrismaWhereFromCustomFilters(
        filters.cfFilters,
        defs,
      );
      if (customWhere) {
        where.custom = customWhere;
      }
    }

    const contacts = await prisma.contact.findMany({
      where,
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

export async function deleteContactsBulk(
  ids: string[]
): Promise<ActionResult<{ deletedCount: number }>> {
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

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: "Nenhum id fornecido" };
  }

  const r = await prisma.contact.deleteMany({
    where: { id: { in: ids }, companyId },
  });

  revalidatePath("/contacts");
  return { success: true, data: { deletedCount: r.count } };
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
  custom?: Record<string, unknown>;
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

  const customValidation = await validateContactCustom(companyId, data.custom);
  if (!customValidation.ok) {
    return { success: false, error: customValidation.error };
  }

  const { ipMask, ua } = await resolveRequestContext();

  let contact: Awaited<ReturnType<typeof prisma.contact.create>>;
  try {
    contact = await prisma.$transaction(async (tx) => {
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
          custom: customValidation.value as Prisma.InputJsonValue,
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
  } catch (err) {
    const dup = translateP2002Contact(err, customValidation.defs);
    if (dup) return { success: false, error: dup };
    throw err;
  }

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
    custom?: Record<string, unknown>;
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

  const customValidation = await validateContactCustom(companyId, data.custom);
  if (!customValidation.ok) {
    return { success: false, error: customValidation.error };
  }
  const customProvided = data.custom !== undefined;

  const { ipMask, ua } = await resolveRequestContext();

  let result: number;
  try {
    result = await prisma.$transaction(async (tx) => {
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
      if (customProvided) patch.custom = customValidation.value as Prisma.InputJsonValue;

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
  } catch (err) {
    const dup = translateP2002Contact(err, customValidation.defs);
    if (dup) return { success: false, error: dup };
    throw err;
  }

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
