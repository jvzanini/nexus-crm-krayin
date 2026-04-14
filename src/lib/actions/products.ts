"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError } from "@/lib/rbac";
import { isSupportedCurrency } from "@/lib/currency/allowlist";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ProductItem {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  active: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  prices: {
    id: string;
    currency: string;
    amount: string;
    active: boolean;
  }[];
}

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Retorna o companyId ativo do usuário logado (primeiro membership ativo). */
async function resolveActiveCompanyId(userId: string): Promise<string | null> {
  const membership = await prisma.userCompanyMembership.findFirst({
    where: { userId, isActive: true },
    select: { companyId: true },
    orderBy: { createdAt: "asc" },
  });
  return membership?.companyId ?? null;
}

function handleError(err: unknown, fallback: string): ActionResult {
  if (err instanceof PermissionDeniedError) {
    return { success: false, error: err.message };
  }
  logger.error({ err }, `products.action.failed`);
  return { success: false, error: fallback };
}

/** Serializa um produto do Prisma para ProductItem. */
function serializeProduct(p: {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  active: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  prices: { id: string; currency: string; amount: Prisma.Decimal; active: boolean }[];
}): ProductItem {
  return {
    id: p.id,
    companyId: p.companyId,
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    active: p.active,
    archivedAt: p.archivedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    prices: p.prices.map((pr) => ({
      id: pr.id,
      currency: pr.currency,
      amount: pr.amount.toString(),
      active: pr.active,
    })),
  };
}

// ---------------------------------------------------------------------------
// Schemas de validação
// ---------------------------------------------------------------------------

const skuSchema = z
  .string()
  .min(1, "SKU obrigatório")
  .max(64, "SKU deve ter no máximo 64 caracteres")
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => /^[A-Z0-9_-]+$/.test(v), {
    message: "SKU deve conter apenas letras, números, hífens e underscores",
  });

const amountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => {
    try {
      const d = new Prisma.Decimal(String(v));
      return d;
    } catch {
      return null;
    }
  })
  .refine((d): d is Prisma.Decimal => d !== null && !d.isNaN(), {
    message: "Valor inválido",
  })
  .refine((d) => d.gte(0), { message: "Valor não pode ser negativo" })
  .refine((d) => d.lte(new Prisma.Decimal("9999999999.9999")), {
    message: "Valor excede o limite máximo",
  });

const currencySchema = z
  .string()
  .refine((c) => isSupportedCurrency(c), { message: "Moeda não suportada" });

const priceInputSchema = z.object({
  currency: currencySchema,
  amount: amountSchema,
  active: z.boolean().optional().default(true),
});

const createProductSchema = z.object({
  sku: skuSchema,
  name: z.string().min(1, "Nome obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  description: z.string().max(2000, "Descrição deve ter no máximo 2000 caracteres").optional(),
  category: z.string().max(100, "Categoria deve ter no máximo 100 caracteres").optional(),
  prices: z.array(priceInputSchema).optional().default([]),
});

const updateProductSchema = z.object({
  sku: skuSchema.optional(),
  name: z
    .string()
    .min(1, "Nome obrigatório")
    .max(200, "Nome deve ter no máximo 200 caracteres")
    .optional(),
  description: z
    .string()
    .max(2000, "Descrição deve ter no máximo 2000 caracteres")
    .nullish(),
  category: z
    .string()
    .max(100, "Categoria deve ter no máximo 100 caracteres")
    .nullish(),
  active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listProducts(filter?: {
  active?: boolean;
  q?: string;
  category?: string;
}): Promise<ActionResult<ProductItem[]>> {
  try {
    const user = await requirePermission("products:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const where: Prisma.ProductWhereInput = { companyId };

    if (filter?.active !== undefined) {
      where.active = filter.active;
    }

    if (filter?.category) {
      where.category = filter.category;
    }

    if (filter?.q) {
      where.OR = [
        { name: { contains: filter.q, mode: "insensitive" } },
        { sku: { contains: filter.q, mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        prices: {
          orderBy: { currency: "asc" },
        },
      },
    });

    return { success: true, data: products.map(serializeProduct) };
  } catch (err) {
    return handleError(err, "Erro ao listar produtos");
  }
}

export async function getProduct(id: string): Promise<ActionResult<ProductItem | null>> {
  try {
    const user = await requirePermission("products:view");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const product = await prisma.product.findUnique({
      where: { id },
      include: { prices: { orderBy: { currency: "asc" } } },
    });

    if (!product || product.companyId !== companyId) {
      return { success: false, error: "Produto não encontrado", data: null };
    }

    return { success: true, data: serializeProduct(product) };
  } catch (err) {
    return handleError(err, "Erro ao buscar produto");
  }
}

// ---------------------------------------------------------------------------
// Mutações
// ---------------------------------------------------------------------------

export async function createProduct(input: {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  prices?: Array<{ currency: string; amount: string | number; active?: boolean }>;
}): Promise<ActionResult<ProductItem>> {
  try {
    const user = await requirePermission("products:create");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const { sku, name, description, category, prices } = parsed.data;

    // Verifica SKU único por empresa
    const existing = await prisma.product.findUnique({
      where: { companyId_sku: { companyId, sku } },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "SKU já existe para esta empresa" };
    }

    const product = await prisma.product.create({
      data: {
        companyId,
        sku,
        name,
        description: description ?? null,
        category: category ?? null,
        active: true,
        prices: {
          create: prices.map((p) => ({
            currency: p.currency,
            amount: p.amount,
            active: p.active ?? true,
          })),
        },
      },
      include: { prices: { orderBy: { currency: "asc" } } },
    });

    revalidatePath("/products");
    return { success: true, data: serializeProduct(product) };
  } catch (err) {
    return handleError(err, "Erro ao criar produto");
  }
}

export async function updateProduct(
  id: string,
  patch: {
    sku?: string;
    name?: string;
    description?: string | null;
    category?: string | null;
    active?: boolean;
  }
): Promise<ActionResult<ProductItem>> {
  try {
    const user = await requirePermission("products:edit");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    // Verifica tenant-scope
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Produto não encontrado" };
    }

    const parsed = updateProductSchema.safeParse(patch);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }

    const data = parsed.data;

    // Se SKU mudou, verifica unicidade
    if (data.sku) {
      const skuConflict = await prisma.product.findUnique({
        where: { companyId_sku: { companyId, sku: data.sku } },
        select: { id: true },
      });
      if (skuConflict && skuConflict.id !== id) {
        return { success: false, error: "SKU já existe para esta empresa" };
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.active !== undefined && { active: data.active }),
      },
      include: { prices: { orderBy: { currency: "asc" } } },
    });

    revalidatePath("/products");
    return { success: true, data: serializeProduct(updated) };
  } catch (err) {
    return handleError(err, "Erro ao atualizar produto");
  }
}

export async function archiveProduct(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("products:edit");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Produto não encontrado" };
    }

    await prisma.product.update({
      where: { id },
      data: { active: false, archivedAt: new Date() },
    });

    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao arquivar produto");
  }
}

export async function unarchiveProduct(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("products:edit");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Produto não encontrado" };
    }

    await prisma.product.update({
      where: { id },
      data: { active: true, archivedAt: null },
    });

    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao desarquivar produto");
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("products:delete");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!existing || existing.companyId !== companyId) {
      return { success: false, error: "Produto não encontrado" };
    }

    await prisma.product.delete({ where: { id } });

    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao excluir produto");
  }
}

// ---------------------------------------------------------------------------
// Preços
// ---------------------------------------------------------------------------

export async function upsertPrice(
  productId: string,
  currency: string,
  amount: string | number,
  active?: boolean
): Promise<ActionResult> {
  try {
    const user = await requirePermission("products:edit");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    const currencyParsed = currencySchema.safeParse(currency);
    if (!currencyParsed.success) {
      return { success: false, error: "Moeda não suportada" };
    }

    const amountParsed = amountSchema.safeParse(amount);
    if (!amountParsed.success) {
      return {
        success: false,
        error: amountParsed.error.issues[0]?.message ?? "Valor inválido",
      };
    }

    // Verifica produto pertence ao tenant
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { companyId: true },
    });
    if (!product || product.companyId !== companyId) {
      return { success: false, error: "Produto não encontrado" };
    }

    await prisma.productPrice.upsert({
      where: { productId_currency: { productId, currency: currencyParsed.data } },
      create: {
        productId,
        currency: currencyParsed.data,
        amount: amountParsed.data,
        active: active ?? true,
      },
      update: {
        amount: amountParsed.data,
        ...(active !== undefined && { active }),
      },
    });

    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao salvar preço");
  }
}

export async function deletePrice(
  productId: string,
  currency: string
): Promise<ActionResult> {
  try {
    const user = await requirePermission("products:edit");
    const companyId = await resolveActiveCompanyId(user.id);
    if (!companyId) return { success: false, error: "Nenhuma empresa ativa encontrada" };

    // Verifica produto pertence ao tenant
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { companyId: true },
    });
    if (!product || product.companyId !== companyId) {
      return { success: false, error: "Produto não encontrado" };
    }

    await prisma.productPrice.delete({
      where: { productId_currency: { productId, currency } },
    });

    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return handleError(err, "Erro ao excluir preço");
  }
}
