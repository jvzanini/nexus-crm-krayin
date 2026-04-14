"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { buildWhereFromFilters } from "@/lib/marketing/segment";
import { logger } from "@/lib/logger";
import { enqueueMarketingSend } from "@/lib/worker/queues/marketing-send";
import {
  createCampaignSchema,
  updateCampaignSchema,
} from "./marketing-campaigns-schemas";
import type { SegmentFilter } from "@/lib/marketing/segment";

export interface CampaignItem {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  mailboxId: string;
  segmentId: string;
  status: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  batchSize: number;
  createdAt: Date;
  updatedAt: Date;
}

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function resolveActiveCompanyId(userId: string): Promise<string | null> {
  const membership = await prisma.userCompanyMembership.findFirst({
    where: { userId, isActive: true },
    select: { companyId: true },
    orderBy: { createdAt: "asc" },
  });
  return membership?.companyId ?? null;
}

function handleError(err: unknown, fallback: string): ActionResult<never> {
  if (err instanceof PermissionDeniedError) {
    return { success: false, error: err.message };
  }
  logger.error({ err }, "marketing.campaigns.action.failed");
  return { success: false, error: fallback };
}

function toCampaignItem(c: any): CampaignItem {
  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    bodyHtml: c.bodyHtml,
    mailboxId: c.mailboxId,
    segmentId: c.segmentId,
    status: c.status,
    scheduledAt: c.scheduledAt,
    startedAt: c.startedAt,
    finishedAt: c.finishedAt,
    batchSize: c.batchSize,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export async function listCampaignsAction(): Promise<ActionResult<CampaignItem[]>> {
  try {
    const user = await requirePermission("marketing:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const campaigns = await prisma.campaign.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: campaigns.map(toCampaignItem) };
  } catch (err) {
    return handleError(err, "Erro ao listar campanhas");
  }
}

export async function getCampaignAction(id: string): Promise<ActionResult<CampaignItem>> {
  try {
    const user = await requirePermission("marketing:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const campaign = await prisma.campaign.findFirst({ where: { id, companyId } });
    if (!campaign) return { success: false, error: "Campanha não encontrada" };

    return { success: true, data: toCampaignItem(campaign) };
  } catch (err) {
    return handleError(err, "Erro ao buscar campanha");
  }
}

export async function createCampaignAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("marketing:manage");
    const parsed = createCampaignSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    // Valida que segmento pertence ao tenant
    const segment = await prisma.segment.findFirst({
      where: { id: parsed.data.segmentId, companyId },
    });
    if (!segment) return { success: false, error: "Segmento não encontrado ou não pertence à empresa" };

    // Valida mailboxId (pertence ao tenant)
    const mailbox = await prisma.mailbox.findFirst({
      where: { id: parsed.data.mailboxId, companyId },
    });
    if (!mailbox) return { success: false, error: "Caixa de entrada não encontrada ou não pertence à empresa" };

    const campaign = await prisma.campaign.create({
      data: {
        name: parsed.data.name,
        subject: parsed.data.subject,
        bodyHtml: parsed.data.bodyHtml,
        mailboxId: parsed.data.mailboxId,
        segmentId: parsed.data.segmentId,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        batchSize: parsed.data.batchSize,
        status: "draft",
        companyId,
        createdBy: user.id,
      },
    });

    return { success: true, data: { id: campaign.id } };
  } catch (err) {
    return handleError(err, "Erro ao criar campanha");
  }
}

export async function updateCampaignAction(
  id: string,
  patch: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("marketing:manage");
    const parsed = updateCampaignSchema.safeParse(patch);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const existing = await prisma.campaign.findFirst({ where: { id, companyId } });
    if (!existing) return { success: false, error: "Campanha não encontrada" };

    if (existing.status !== "draft") {
      return { success: false, error: "Apenas campanhas em rascunho podem ser editadas" };
    }

    // Valida segmentId se fornecido
    if (parsed.data.segmentId) {
      const segment = await prisma.segment.findFirst({
        where: { id: parsed.data.segmentId, companyId },
      });
      if (!segment) return { success: false, error: "Segmento não encontrado ou não pertence à empresa" };
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.subject !== undefined && { subject: parsed.data.subject }),
        ...(parsed.data.bodyHtml !== undefined && { bodyHtml: parsed.data.bodyHtml }),
        ...(parsed.data.segmentId !== undefined && { segmentId: parsed.data.segmentId }),
        ...(parsed.data.scheduledAt !== undefined && {
          scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        }),
        ...(parsed.data.batchSize !== undefined && { batchSize: parsed.data.batchSize }),
      },
    });

    return { success: true, data: { id: campaign.id } };
  } catch (err) {
    return handleError(err, "Erro ao atualizar campanha");
  }
}

export async function activateCampaignAction(
  id: string,
): Promise<ActionResult<{ enqueued: number }>> {
  try {
    const user = await requirePermission("marketing:send");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    // Carrega campaign + segment tenant-scoped
    const campaign = await prisma.campaign.findFirst({
      where: { id, companyId },
      include: { segment: true },
    });
    if (!campaign) return { success: false, error: "Campanha não encontrada" };
    if (campaign.status !== "draft") {
      return { success: false, error: "Apenas campanhas em rascunho podem ser ativadas" };
    }

    // Resolve contatos do segmento com consentMarketing=true
    const segmentFilters = campaign.segment.filters as unknown as SegmentFilter[];
    const filterWhere = buildWhereFromFilters(segmentFilters);
    const contactWhere = {
      AND: [...filterWhere.AND, { consentMarketing: true }, { companyId }],
    };

    const contacts = await prisma.contact.findMany({
      where: contactWhere as any,
      select: { id: true },
    });

    if (contacts.length === 0) {
      return { success: false, error: "Nenhum contato elegível no segmento" };
    }

    // Determina status da campanha
    const now = new Date();
    const isScheduledFuture =
      campaign.scheduledAt !== null && campaign.scheduledAt > now;
    const newStatus = isScheduledFuture ? "scheduled" : "sending";

    // Transaction: insert recipients em bulk + update campaign status
    const recipients = await prisma.$transaction(async (tx) => {
      // Insert recipients (upsert para idempotência)
      await tx.campaignRecipient.createMany({
        data: contacts.map((c) => ({
          campaignId: id,
          contactId: c.id,
          status: "pending",
        })),
        skipDuplicates: true,
      });

      // Busca recipients criados
      const created = await tx.campaignRecipient.findMany({
        where: { campaignId: id, status: "pending" },
        select: { id: true },
      });

      // Atualiza status da campanha
      await tx.campaign.update({
        where: { id },
        data: {
          status: newStatus as any,
          startedAt: newStatus === "sending" ? now : null,
        },
      });

      return created;
    });

    // Para status=sending: enfileira jobs
    if (newStatus === "sending") {
      await Promise.all(recipients.map((r) => enqueueMarketingSend(r.id)));
    }

    logger.info(
      { campaignId: id, status: newStatus, enqueued: recipients.length },
      "marketing.campaign.activated",
    );

    return { success: true, data: { enqueued: recipients.length } };
  } catch (err) {
    return handleError(err, "Erro ao ativar campanha");
  }
}

export async function pauseCampaignAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("marketing:send");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const campaign = await prisma.campaign.findFirst({ where: { id, companyId } });
    if (!campaign) return { success: false, error: "Campanha não encontrada" };
    if (!["sending", "scheduled"].includes(campaign.status)) {
      return { success: false, error: "Campanha não pode ser pausada no status atual" };
    }

    await prisma.campaign.update({ where: { id }, data: { status: "paused" } });
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao pausar campanha");
  }
}

export async function resumeCampaignAction(id: string): Promise<ActionResult<{ enqueued: number }>> {
  try {
    const user = await requirePermission("marketing:send");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const campaign = await prisma.campaign.findFirst({ where: { id, companyId } });
    if (!campaign) return { success: false, error: "Campanha não encontrada" };
    if (campaign.status !== "paused") {
      return { success: false, error: "Apenas campanhas pausadas podem ser retomadas" };
    }

    // Reativa: busca recipients pending e re-enfileira
    const pendingRecipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: id, status: "pending" },
      select: { id: true },
    });

    await prisma.campaign.update({ where: { id }, data: { status: "sending" } });

    if (pendingRecipients.length > 0) {
      await Promise.all(pendingRecipients.map((r) => enqueueMarketingSend(r.id)));
    }

    return { success: true, data: { enqueued: pendingRecipients.length } };
  } catch (err) {
    return handleError(err, "Erro ao retomar campanha");
  }
}

export async function cancelCampaignAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("marketing:send");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const campaign = await prisma.campaign.findFirst({ where: { id, companyId } });
    if (!campaign) return { success: false, error: "Campanha não encontrada" };
    if (["sent", "canceled", "failed"].includes(campaign.status)) {
      return { success: false, error: "Campanha não pode ser cancelada no status atual" };
    }

    await prisma.campaign.update({ where: { id }, data: { status: "canceled" } });
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao cancelar campanha");
  }
}

export async function getCampaignStatsAction(
  id: string,
): Promise<ActionResult<{ byStatus: Record<string, number>; total: number }>> {
  try {
    const user = await requirePermission("marketing:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    // Verifica que campanha pertence ao tenant
    const campaign = await prisma.campaign.findFirst({ where: { id, companyId } });
    if (!campaign) return { success: false, error: "Campanha não encontrada" };

    const grouped = await prisma.campaignRecipient.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: true,
    });

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      byStatus[g.status] = g._count;
      total += g._count;
    }

    return { success: true, data: { byStatus, total } };
  } catch (err) {
    return handleError(err, "Erro ao buscar estatísticas da campanha");
  }
}
