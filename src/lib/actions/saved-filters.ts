"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { SavedFilter } from "@/generated/prisma/client";
import { requirePermission, PermissionDeniedError, type Permission } from "@/lib/rbac";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  SaveFilterSchema,
  UpdateFilterSchema,
  SetDefaultSchema,
  SavedFilterModuleZ,
  type SavedFilterModuleKey,
} from "./saved-filters-schemas";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

const MAX_FILTERS_PER_MODULE = 20;

/**
 * Mapeia moduleKey → Permission usada para gate do CRUD. `tasks` reusa
 * `activities:view`, `campaigns`/`segments` reusam `marketing:view`, demais
 * seguem a convenção `${module}:view`.
 */
function permissionForModule(moduleKey: SavedFilterModuleKey): Permission {
  switch (moduleKey) {
    case "tasks":
      return "activities:view";
    case "campaigns":
    case "segments":
      return "marketing:view";
    case "workflows":
      return "workflows:view";
    case "leads":
      return "leads:view";
    case "contacts":
      return "contacts:view";
    case "opportunities":
      return "opportunities:view";
    case "products":
      return "products:view";
  }
}

function handleError(err: unknown, fallback: string): ActionResult<never> {
  if (err instanceof PermissionDeniedError) {
    return { success: false, error: err.message };
  }
  logger.error({ err }, "saved-filters.action.failed");
  return { success: false, error: fallback };
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export async function listSavedFilters(raw: {
  moduleKey: SavedFilterModuleKey;
}): Promise<ActionResult<SavedFilter[]>> {
  try {
    const parsed = SavedFilterModuleZ.safeParse(raw?.moduleKey);
    if (!parsed.success) {
      return { success: false, error: "Módulo inválido" };
    }
    const moduleKey = parsed.data;

    try {
      await requirePermission(permissionForModule(moduleKey));
    } catch {
      // Se perdeu permissão: retorna lista vazia (não quebra UI).
      return { success: true, data: [] };
    }

    const companyId = await requireActiveCompanyId();
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Não autenticado" };

    const list = await prisma.savedFilter.findMany({
      where: { userId: user.id, companyId, moduleKey },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return { success: true, data: list };
  } catch (err) {
    return handleError(err, "Erro ao listar filtros salvos");
  }
}

// ---------------------------------------------------------------------------
// GET DEFAULT (helper síncrono para Server Components, SEM ActionResult)
// ---------------------------------------------------------------------------

export async function getDefaultFilter(
  moduleKey: SavedFilterModuleKey,
): Promise<SavedFilter | null> {
  try {
    const parsed = SavedFilterModuleZ.safeParse(moduleKey);
    if (!parsed.success) return null;

    const user = await getCurrentUser();
    if (!user) return null;
    const companyId = await requireActiveCompanyId().catch(() => null);
    if (!companyId) return null;

    const found = await prisma.savedFilter.findFirst({
      where: {
        userId: user.id,
        companyId,
        moduleKey: parsed.data,
        isDefault: true,
      },
    });
    return found;
  } catch (err) {
    logger.warn({ err }, "saved-filters.getDefault.failed");
    return null;
  }
}

// ---------------------------------------------------------------------------
// SAVE (create)
// ---------------------------------------------------------------------------

export async function saveFilter(
  raw: unknown,
): Promise<ActionResult<SavedFilter>> {
  try {
    const parsed = SaveFilterSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }
    const { moduleKey, name, filters, setAsDefault } = parsed.data;

    await requirePermission(permissionForModule(moduleKey));
    const companyId = await requireActiveCompanyId();
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Não autenticado" };

    const count = await prisma.savedFilter.count({
      where: { userId: user.id, companyId, moduleKey },
    });
    if (count >= MAX_FILTERS_PER_MODULE) {
      return {
        success: false,
        error: "Limite de 20 filtros salvos por módulo atingido",
      };
    }

    // Detecta nome duplicado antes do create (mensagem PT-BR clara).
    const dup = await prisma.savedFilter.findFirst({
      where: { userId: user.id, companyId, moduleKey, name },
      select: { id: true },
    });
    if (dup) {
      return {
        success: false,
        error: "Já existe um filtro salvo com este nome",
      };
    }

    let created: SavedFilter;
    if (setAsDefault) {
      const [, createdRow] = await prisma.$transaction([
        prisma.savedFilter.updateMany({
          where: { userId: user.id, companyId, moduleKey, isDefault: true },
          data: { isDefault: false },
        }),
        prisma.savedFilter.create({
          data: {
            userId: user.id,
            companyId,
            moduleKey,
            name,
            filters,
            isDefault: true,
          },
        }),
      ]);
      created = createdRow;
    } else {
      created = await prisma.savedFilter.create({
        data: {
          userId: user.id,
          companyId,
          moduleKey,
          name,
          filters,
          isDefault: false,
        },
      });
    }

    revalidatePath(`/${moduleKey}`);
    return { success: true, data: created };
  } catch (err) {
    return handleError(err, "Erro ao salvar filtro");
  }
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updateFilter(
  raw: unknown,
): Promise<ActionResult<SavedFilter>> {
  try {
    const parsed = UpdateFilterSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }
    const { id, name, filters, setAsDefault } = parsed.data;

    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Não autenticado" };
    const companyId = await requireActiveCompanyId();

    // Descobre moduleKey via registro existente para gate da permissão.
    const existing = await prisma.savedFilter.findFirst({
      where: { id, userId: user.id, companyId },
      select: { moduleKey: true },
    });
    if (!existing) {
      return { success: false, error: "Filtro não encontrado" };
    }
    await requirePermission(permissionForModule(existing.moduleKey));

    // Caso setAsDefault: delega para transação (unset + set).
    if (setAsDefault === true) {
      const [, updated] = await prisma.$transaction([
        prisma.savedFilter.updateMany({
          where: {
            userId: user.id,
            companyId,
            moduleKey: existing.moduleKey,
            isDefault: true,
          },
          data: { isDefault: false },
        }),
        prisma.savedFilter.update({
          where: { id },
          data: {
            isDefault: true,
            ...(name !== undefined ? { name } : {}),
            ...(filters !== undefined ? { filters } : {}),
          },
        }),
      ]);
      revalidatePath(`/${existing.moduleKey}`);
      return { success: true, data: updated };
    }

    // Update comum (pode incluir setAsDefault=false).
    const updated = await prisma.savedFilter.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(filters !== undefined ? { filters } : {}),
        ...(setAsDefault === false ? { isDefault: false } : {}),
      },
    });
    revalidatePath(`/${existing.moduleKey}`);
    return { success: true, data: updated };
  } catch (err) {
    return handleError(err, "Erro ao atualizar filtro");
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deleteFilter(
  id: string,
): Promise<ActionResult<{ deletedId: string }>> {
  try {
    if (typeof id !== "string" || id.length === 0) {
      return { success: false, error: "ID inválido" };
    }

    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Não autenticado" };
    const companyId = await requireActiveCompanyId();

    const existing = await prisma.savedFilter.findFirst({
      where: { id, userId: user.id, companyId },
      select: { moduleKey: true },
    });
    if (!existing) {
      return { success: false, error: "Filtro não encontrado" };
    }
    await requirePermission(permissionForModule(existing.moduleKey));

    await prisma.savedFilter.delete({
      where: { id },
    });

    revalidatePath(`/${existing.moduleKey}`);
    return { success: true, data: { deletedId: id } };
  } catch (err) {
    return handleError(err, "Erro ao excluir filtro");
  }
}

// ---------------------------------------------------------------------------
// SET DEFAULT (transacional)
// ---------------------------------------------------------------------------

export async function setDefaultFilter(
  raw: unknown,
): Promise<ActionResult<SavedFilter>> {
  try {
    const parsed = SetDefaultSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }
    const { id, moduleKey } = parsed.data;

    await requirePermission(permissionForModule(moduleKey));
    const companyId = await requireActiveCompanyId();
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Não autenticado" };

    // Ownership check: registro precisa pertencer ao user/company/moduleKey.
    const existing = await prisma.savedFilter.findFirst({
      where: { id, userId: user.id, companyId, moduleKey },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Filtro não encontrado" };
    }

    const [, updated] = await prisma.$transaction([
      prisma.savedFilter.updateMany({
        where: { userId: user.id, companyId, moduleKey, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.savedFilter.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    revalidatePath(`/${moduleKey}`);
    return { success: true, data: updated };
  } catch (err) {
    return handleError(err, "Erro ao definir filtro padrão");
  }
}
