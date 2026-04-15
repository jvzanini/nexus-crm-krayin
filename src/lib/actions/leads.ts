"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "../../generated/prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordConsent, maskIp } from "@/lib/consent";
import { z } from "zod";
import { dispatch } from "@/lib/automation/dispatcher";
import { logger } from "@/lib/logger";
import { requireActiveCompanyId, NoActiveCompanyError } from "@/lib/tenant-scope";
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
  consentMarketing: boolean;
  consentTracking: boolean;
  custom?: unknown;
}

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export interface LeadsFilters {
  status?: string;
  source?: string;
  from?: string;
  to?: string;
  q?: string;
  /** Filtros custom pré-parseados (cf[key][op]=value). */
  custom?: CustomFilter[];
}

const VALID_LEAD_STATUS = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
] as const;

const consentSchema = z.object({
  marketing: z.boolean(),
  tracking: z.boolean(),
});

const leadFieldsSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  company: z.string().nullish(),
  source: z.string().nullish(),
  status: z
    .enum(["new", "contacted", "qualified", "unqualified", "converted"])
    .default("new"),
  notes: z.string().nullish(),
  assignedTo: z.string().uuid().nullish(),
});

const createLeadSchema = z.object({
  fields: leadFieldsSchema,
  consent: consentSchema,
});

const updateLeadSchema = z.object({
  fields: leadFieldsSchema.partial(),
  consent: consentSchema.optional(),
});

/**
 * Valida `custom` contra definitions ativas do tenant/entity=lead.
 * Retorna `{ ok: true, value }` ou `{ ok: false, error }` para ActionResult.
 */
async function validateLeadCustom(
  companyId: string,
  custom: Record<string, unknown> | undefined,
): Promise<
  | { ok: true; value: Record<string, unknown>; defs: Awaited<ReturnType<typeof listCustomAttributes>> }
  | { ok: false; error: string }
> {
  const defs = await listCustomAttributes(companyId, "lead");
  const payload = custom ?? {};
  try {
    const schema = buildZodFromDefinitions(defs);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Campos customizados inválidos",
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
 * Traduz erro Prisma P2002 em índice `idx_leads_custom_<key>_unique` para
 * mensagem amigável "Valor duplicado em <label>".
 * Retorna `null` se o erro não matcha o padrão.
 */
function translateP2002Lead(
  err: unknown,
  defs: Awaited<ReturnType<typeof listCustomAttributes>>,
): string | null {
  const parsed = parseP2002IndexName(err);
  if (!parsed || parsed.entity !== "lead") return null;
  const def = defs.find((d) => d.key === parsed.key);
  const label = def?.label ?? parsed.key;
  return `Valor duplicado em ${label}`;
}

async function resolveRequestContext() {
  const h = await headers();
  const xff = h.get("x-forwarded-for") ?? "";
  const ipRaw = xff.split(",")[0]?.trim() ?? "";
  const ipMask = maskIp(ipRaw);
  const ua = (h.get("user-agent") ?? "").slice(0, 200) || null;
  return { ipMask, ua };
}

export async function getLeads(
  filters?: LeadsFilters
): Promise<ActionResult<LeadItem[]>> {
  try {
    await requirePermission("leads:view");

    let companyId: string;
    try {
      companyId = await requireActiveCompanyId();
    } catch {
      return { success: false, error: "Empresa ativa não encontrada" };
    }

    const where: Record<string, unknown> = { companyId };
    if (
      filters?.status &&
      (VALID_LEAD_STATUS as readonly string[]).includes(filters.status)
    ) {
      where.status = filters.status;
    }
    if (filters?.source) {
      where.source = { contains: filters.source, mode: "insensitive" };
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
    if (filters?.q) {
      where.OR = [
        { name: { contains: filters.q, mode: "insensitive" } },
        { email: { contains: filters.q, mode: "insensitive" } },
      ];
    }
    if (filters?.custom && filters.custom.length > 0) {
      const defs = await listCustomAttributes(companyId, "lead");
      try {
        const customWhere = buildPrismaWhereFromCustomFilters(
          filters.custom,
          defs,
        );
        if (customWhere) where.custom = customWhere;
      } catch {
        // op inválido para o tipo → ignora silenciosamente (filter UI deve prevenir).
      }
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: leads };
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }
}

export async function deleteLeadsBulk(
  ids: string[]
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    await requirePermission("leads:delete");
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

  const r = await prisma.lead.deleteMany({
    where: { id: { in: ids }, companyId },
  });

  revalidatePath("/leads");
  return { success: true, data: { deletedCount: r.count } };
}

const VALID_LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
] as const;

type LeadStatus = typeof VALID_LEAD_STATUSES[number];

export async function updateLeadsStatusBulk(
  ids: string[],
  status: string,
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    await requirePermission("leads:edit");
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
  if (!VALID_LEAD_STATUSES.includes(status as LeadStatus)) {
    return { success: false, error: "Status inválido" };
  }

  const r = await prisma.lead.updateMany({
    where: { id: { in: ids }, companyId },
    data: { status: status as LeadStatus },
  });

  revalidatePath("/leads");
  return { success: true, data: { updatedCount: r.count } };
}

export async function assignLeadsBulk(
  ids: string[],
  assigneeId: string | null,
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    await requirePermission("leads:edit");
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

  const r = await prisma.lead.updateMany({
    where: { id: { in: ids }, companyId },
    data: { assignedTo: assigneeId },
  });

  revalidatePath("/leads");
  return { success: true, data: { updatedCount: r.count } };
}

export async function getCompanyAssignees(): Promise<
  ActionResult<{ id: string; name: string; email: string }[]>
> {
  try {
    await requirePermission("leads:view");
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return { success: false, error: "Sem permissão" };
    }
    throw err;
  }

  let companyId: string;
  try {
    companyId = await requireActiveCompanyId();
  } catch {
    return { success: false, error: "Empresa ativa não encontrada" };
  }

  const memberships = await prisma.userCompanyMembership.findMany({
    where: { companyId, isActive: true },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return {
    success: true,
    data: memberships.map((m) => m.user),
  };
}

export async function createLead(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  status?: string;
  notes?: string | null;
  assignedTo?: string | null;
  consent: { marketing: boolean; tracking: boolean };
  custom?: Record<string, unknown>;
}): Promise<ActionResult<{ id: string }>> {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    user = await requirePermission("leads:create");
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

  const parsed = createLeadSchema.safeParse({
    fields: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      source: data.source,
      status: data.status,
      notes: data.notes,
      assignedTo: data.assignedTo,
    },
    consent: data.consent,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const customValidation = await validateLeadCustom(companyId, data.custom);
  if (!customValidation.ok) {
    return { success: false, error: customValidation.error };
  }

  const { ipMask, ua } = await resolveRequestContext();

  let lead: Awaited<ReturnType<typeof prisma.lead.create>>;
  try {
    lead = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const created = await tx.lead.create({
      data: {
        companyId,
        ...parsed.data.fields,
        email: parsed.data.fields.email ?? null,
        phone: parsed.data.fields.phone ?? null,
        company: parsed.data.fields.company ?? null,
        source: parsed.data.fields.source ?? null,
        notes: parsed.data.fields.notes ?? null,
        assignedTo: parsed.data.fields.assignedTo ?? null,
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
      subjectType: "lead",
      subjectId: created.id,
      consent: parsed.data.consent,
      source: "lead_form",
      ipMask,
      userAgent: ua,
      grantedBy: user.id,
    });
    return created;
  });
  } catch (err) {
    const dup = translateP2002Lead(err, customValidation.defs);
    if (dup) return { success: false, error: dup };
    throw err;
  }

  revalidatePath("/leads");

  await dispatch("lead_created", {
    companyId,
    payload: {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
      status: lead.status,
      consentMarketing: lead.consentMarketing,
      consentTracking: lead.consentTracking,
    },
  }).catch((err) =>
    logger.warn({ err, leadId: lead.id }, "automation.dispatch.lead_created.failed")
  );

  return { success: true, data: { id: lead.id } };
}

export async function updateLead(
  id: string,
  data: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    source?: string | null;
    status?: string;
    notes?: string | null;
    assignedTo?: string | null;
    consent?: { marketing: boolean; tracking: boolean };
    custom?: Record<string, unknown>;
  }
): Promise<ActionResult> {
  let user: Awaited<ReturnType<typeof requirePermission>>;
  try {
    user = await requirePermission("leads:edit");
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

  const parsed = updateLeadSchema.safeParse({
    fields: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      source: data.source,
      status: data.status,
      notes: data.notes,
      assignedTo: data.assignedTo,
    },
    consent: data.consent,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const customValidation =
    data.custom !== undefined
      ? await validateLeadCustom(companyId, data.custom)
      : null;
  if (customValidation && !customValidation.ok) {
    return { success: false, error: customValidation.error };
  }
  const defsForP2002 = customValidation?.ok
    ? customValidation.defs
    : await listCustomAttributes(companyId, "lead");

  const { ipMask, ua } = await resolveRequestContext();

  let result: number;
  try {
    result = await prisma.$transaction(async (tx) => {
    const patch: Record<string, unknown> = {};
    const f = parsed.data.fields;
    if (f.name !== undefined) patch.name = f.name;
    if (f.email !== undefined) patch.email = f.email ?? null;
    if (f.phone !== undefined) patch.phone = f.phone ?? null;
    if (f.company !== undefined) patch.company = f.company ?? null;
    if (f.source !== undefined) patch.source = f.source ?? null;
    if (f.status !== undefined) patch.status = f.status;
    if (f.notes !== undefined) patch.notes = f.notes ?? null;
    if (f.assignedTo !== undefined) patch.assignedTo = f.assignedTo ?? null;
    if (customValidation?.ok) patch.custom = customValidation.value;

    let count = 0;
    if (Object.keys(patch).length > 0) {
      const r = await tx.lead.updateMany({ where: { id, companyId }, data: patch });
      count = r.count;
    } else {
      // Se só há consent sem fields, confirma existência do lead no tenant.
      const exists = await tx.lead.findFirst({ where: { id, companyId }, select: { id: true } });
      count = exists ? 1 : 0;
    }

    if (count === 0) return 0;

    if (parsed.data.consent) {
      await recordConsent(tx, {
        subjectType: "lead",
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
    const dup = translateP2002Lead(err, defsForP2002);
    if (dup) return { success: false, error: dup };
    throw err;
  }

  if (result === 0) {
    return { success: false, error: "Lead não encontrado" };
  }

  revalidatePath("/leads");
  return { success: true };
}

export async function deleteLead(id: string): Promise<ActionResult> {
  try {
    await requirePermission("leads:delete");
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

  const r = await prisma.lead.deleteMany({ where: { id, companyId } });
  if (r.count === 0) {
    return { success: false, error: "Lead não encontrado" };
  }

  revalidatePath("/leads");
  return { success: true };
}

// Re-export for tests
export { NoActiveCompanyError };
