"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { buildWhereFromFilters } from "@/lib/marketing/segment";
import { logger } from "@/lib/logger";
import {
  createSegmentSchema,
  updateSegmentSchema,
  previewSegmentSchema,
  SegmentsFiltersSchema,
} from "./marketing-segments-schemas";
import type { SegmentsFilters } from "./marketing-segments-schemas";
import type { SegmentFilter } from "@/lib/marketing/segment";

export interface SegmentItem {
  id: string;
  name: string;
  description: string | null;
  filters: SegmentFilter[];
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
  logger.error({ err }, "marketing.segments.action.failed");
  return { success: false, error: fallback };
}

export async function listSegmentsAction(
  raw?: unknown,
): Promise<ActionResult<SegmentItem[]>> {
  try {
    const user = await requirePermission("marketing:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const parsed = SegmentsFiltersSchema.safeParse(raw ?? {});
    const filters: SegmentsFilters = parsed.success ? parsed.data : {};

    const where: Record<string, unknown> = { companyId };
    if (filters.q) {
      where.name = { contains: filters.q, mode: "insensitive" };
    }
    if (filters.from || filters.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) createdAt.gte = new Date(filters.from);
      if (filters.to) {
        const end = new Date(filters.to);
        end.setUTCHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    const segments = await prisma.segment.findMany({
      where: where as any,
      orderBy: { updatedAt: "desc" },
    });

    return {
      success: true,
      data: segments.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        filters: s.filters as unknown as SegmentFilter[],
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    };
  } catch (err) {
    return handleError(err, "Erro ao listar segmentos");
  }
}

export async function getSegmentAction(id: string): Promise<ActionResult<SegmentItem>> {
  try {
    const user = await requirePermission("marketing:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const segment = await prisma.segment.findFirst({
      where: { id, companyId },
    });
    if (!segment) return { success: false, error: "Segmento não encontrado" };

    return {
      success: true,
      data: {
        id: segment.id,
        name: segment.name,
        description: segment.description,
        filters: segment.filters as unknown as SegmentFilter[],
        createdAt: segment.createdAt,
        updatedAt: segment.updatedAt,
      },
    };
  } catch (err) {
    return handleError(err, "Erro ao buscar segmento");
  }
}

export async function createSegmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("marketing:manage");
    const parsed = createSegmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const segment = await prisma.segment.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        filters: parsed.data.filters as any,
        companyId,
        createdBy: user.id,
      },
    });

    return { success: true, data: { id: segment.id } };
  } catch (err) {
    return handleError(err, "Erro ao criar segmento");
  }
}

export async function updateSegmentAction(
  id: string,
  patch: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("marketing:manage");
    const parsed = updateSegmentSchema.safeParse(patch);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const existing = await prisma.segment.findFirst({ where: { id, companyId } });
    if (!existing) return { success: false, error: "Segmento não encontrado" };

    const segment = await prisma.segment.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.filters !== undefined && { filters: parsed.data.filters as any }),
      },
    });

    return { success: true, data: { id: segment.id } };
  } catch (err) {
    return handleError(err, "Erro ao atualizar segmento");
  }
}

export async function previewSegmentAction(input: unknown): Promise<
  ActionResult<{
    count: number;
    sample: { id: string; email: string | null; firstName: string; lastName: string }[];
  }>
> {
  try {
    const user = await requirePermission("marketing:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const parsed = previewSegmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const where = buildWhereFromFilters(parsed.data.filters);
    const finalWhere = {
      AND: [...where.AND, { consentMarketing: true }, { companyId }],
    };

    const [count, sample] = await Promise.all([
      prisma.contact.count({ where: finalWhere as any }),
      prisma.contact.findMany({
        where: finalWhere as any,
        take: 5,
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
    ]);

    return { success: true, data: { count, sample } };
  } catch (err) {
    return handleError(err, "Erro ao prévia do segmento");
  }
}

export async function deleteSegmentAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("marketing:manage");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    const existing = await prisma.segment.findFirst({ where: { id, companyId } });
    if (!existing) return { success: false, error: "Segmento não encontrado" };

    // Verifica se há campanha ativa referenciando este segmento
    const activeCampaign = await prisma.campaign.findFirst({
      where: {
        segmentId: id,
        status: { in: ["scheduled", "sending", "paused"] },
      },
      select: { id: true, name: true },
    });
    if (activeCampaign) {
      return {
        success: false,
        error: "Segmento está em uso por campanha ativa",
      };
    }

    try {
      await prisma.segment.delete({ where: { id } });
    } catch (deleteErr: any) {
      // Prisma FK Restrict lança P2003
      if (deleteErr?.code === "P2003") {
        return { success: false, error: "Segmento está em uso por campanha ativa" };
      }
      throw deleteErr;
    }

    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao excluir segmento");
  }
}

export async function deleteSegmentsBulkAction(
  ids: string[],
): Promise<ActionResult<{ deletedCount: number; skippedInUse: number }>> {
  try {
    const user = await requirePermission("marketing:manage");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Empresa ativa não encontrada" };

    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false, error: "Nenhum segmento selecionado" };
    }
    if (ids.length > 500) {
      return { success: false, error: "Limite de 500 itens por operação" };
    }

    const inUseRows = await prisma.campaign.findMany({
      where: {
        segmentId: { in: ids },
        status: { in: ["scheduled", "sending", "paused"] },
      },
      select: { segmentId: true },
    });
    const inUseIds = new Set(inUseRows.map((r) => r.segmentId));
    const deletable = ids.filter((id) => !inUseIds.has(id));

    if (deletable.length === 0) {
      return {
        success: false,
        error: "Todos os segmentos selecionados estão em uso por campanhas ativas",
      };
    }

    const result = await prisma.segment.deleteMany({
      where: { id: { in: deletable }, companyId },
    });

    return {
      success: true,
      data: {
        deletedCount: result.count,
        skippedInUse: inUseIds.size,
      },
    };
  } catch (err) {
    return handleError(err, "Erro ao excluir segmentos em massa");
  }
}
