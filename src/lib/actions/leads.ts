"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordConsent, maskIp } from "@/lib/consent";
import { z } from "zod";
import { dispatch } from "@/lib/automation/dispatcher";
import { logger } from "@/lib/logger";
import { requireActiveCompanyId, NoActiveCompanyError } from "@/lib/tenant-scope";

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

async function resolveRequestContext() {
  const h = await headers();
  const xff = h.get("x-forwarded-for") ?? "";
  const ipRaw = xff.split(",")[0]?.trim() ?? "";
  const ipMask = maskIp(ipRaw);
  const ua = (h.get("user-agent") ?? "").slice(0, 200) || null;
  return { ipMask, ua };
}

export async function getLeads(): Promise<ActionResult<LeadItem[]>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

  let companyId: string;
  try {
    companyId = await requireActiveCompanyId();
  } catch {
    return { success: false, error: "Empresa ativa não encontrada" };
  }

  const leads = await prisma.lead.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, data: leads };
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
}): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

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

  const { ipMask, ua } = await resolveRequestContext();

  const lead = await prisma.$transaction(async (tx) => {
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

  const { ipMask, ua } = await resolveRequestContext();

  const result = await prisma.$transaction(async (tx) => {
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

  if (result === 0) {
    return { success: false, error: "Lead não encontrado" };
  }

  revalidatePath("/leads");
  return { success: true };
}

export async function deleteLead(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autenticado" };

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
