"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordConsent, maskIp } from "@/lib/consent";
import { z } from "zod";

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

  const leads = await prisma.lead.findMany({
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

  await prisma.$transaction(async (tx) => {
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

    if (Object.keys(patch).length > 0) {
      await tx.lead.update({ where: { id }, data: patch });
    }

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
