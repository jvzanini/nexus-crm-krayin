"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionDeniedError as RbacPermissionDeniedError } from "@/lib/rbac";
import {
  createCompanySchema,
  updateCompanySchema,
  assertCanCreateCompany,
  assertCanUpdateCompany,
  assertCanDeleteCompany,
  PermissionDeniedError,
} from "@nexusai360/companies-ui/server-helpers";
import type { CompanyItem } from "@nexusai360/companies-ui/server-helpers";
import { slugify } from "@nexusai360/multi-tenant";

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function toCompanyItem(
  c: {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    _count: { memberships: number };
  },
  currentUser: { isSuperAdmin: boolean; platformRole: string }
): CompanyItem {
  const canManage =
    currentUser.isSuperAdmin ||
    currentUser.platformRole === "admin";

  return {
    id: c.id,
    name: c.name,
    cnpj: null,
    email: null,
    phone: null,
    address: null,
    isActive: c.isActive,
    membersCount: c._count.memberships,
    createdAt: c.createdAt,
    canEdit: canManage,
    canDelete: canManage,
  };
}

const COMPANY_SELECT = {
  id: true,
  name: true,
  isActive: true,
  createdAt: true,
  _count: { select: { memberships: true } },
} as const;

export async function getCompanies(): Promise<ActionResult<CompanyItem[]>> {
  let user;
  try {
    user = await requirePermission("companies:view");
  } catch (err) {
    if (err instanceof RbacPermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: COMPANY_SELECT,
  });

  return {
    success: true,
    data: companies.map((c) => toCompanyItem(c, user)),
  };
}

export async function getCompany(id: string) {
  try {
    await requirePermission("companies:view");
  } catch (err) {
    if (err instanceof RbacPermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true, platformRole: true } } },
      },
    },
  });

  if (!company) return { success: false, error: "Empresa não encontrada" };
  return { success: true, company };
}

export async function createCompany(
  input: unknown
): Promise<ActionResult<CompanyItem>> {
  let user;
  try {
    user = await requirePermission("companies:manage");
  } catch (err) {
    if (err instanceof RbacPermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  try {
    assertCanCreateCompany(user as any);
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { success: false, error: e.message };
    }
    throw e;
  }

  const parsed = createCompanySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos" };

  const slug = slugify(parsed.data.name);
  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) {
    return { success: false, error: "Já existe uma empresa com esse nome" };
  }

  const company = await prisma.company.create({
    data: { name: parsed.data.name, slug },
    select: COMPANY_SELECT,
  });

  return { success: true, data: toCompanyItem(company, user) };
}

export async function updateCompany(
  id: string,
  input: unknown
): Promise<ActionResult<CompanyItem>> {
  let user;
  try {
    user = await requirePermission("companies:manage");
  } catch (err) {
    if (err instanceof RbacPermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  try {
    assertCanUpdateCompany(user as any);
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { success: false, error: e.message };
    }
    throw e;
  }

  const parsed = updateCompanySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos" };

  // Aceitar isActive diretamente no input (para toggleCompanyActive)
  const rawInput = input as Record<string, unknown>;
  const isActive = typeof rawInput?.isActive === "boolean" ? rawInput.isActive : undefined;

  const company = await prisma.company.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name, slug: slugify(parsed.data.name) } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
    select: COMPANY_SELECT,
  });

  return { success: true, data: toCompanyItem(company, user) };
}

export async function deleteCompany(id: string): Promise<ActionResult<void>> {
  let user;
  try {
    user = await requirePermission("companies:manage");
  } catch (err) {
    if (err instanceof RbacPermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  try {
    assertCanDeleteCompany(user as any);
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { success: false, error: e.message };
    }
    throw e;
  }

  await prisma.userCompanyMembership.deleteMany({ where: { companyId: id } });
  await prisma.company.delete({ where: { id } });

  return { success: true, data: undefined };
}

export async function toggleCompanyActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<CompanyItem>> {
  return updateCompany(id, { isActive });
}

export async function addMember(companyId: string, userId: string, role: string) {
  try {
    await requirePermission("companies:manage");
  } catch (err) {
    if (err instanceof RbacPermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  const existing = await prisma.userCompanyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });

  if (existing) {
    await prisma.userCompanyMembership.update({
      where: { userId_companyId: { userId, companyId } },
      data: { role: role as any, isActive: true },
    });
  } else {
    await prisma.userCompanyMembership.create({
      data: { userId, companyId, role: role as any },
    });
  }

  return { success: true };
}

export async function removeMember(companyId: string, userId: string) {
  try {
    await requirePermission("companies:manage");
  } catch (err) {
    if (err instanceof RbacPermissionDeniedError) {
      return { success: false, error: "Sem permissão para esta ação" };
    }
    throw err;
  }

  await prisma.userCompanyMembership.update({
    where: { userId_companyId: { userId, companyId } },
    data: { isActive: false },
  });

  return { success: true };
}
