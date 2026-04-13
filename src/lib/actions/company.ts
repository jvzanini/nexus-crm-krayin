"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function getCompanies() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { memberships: true } } },
  });

  return { success: true, companies };
}

export async function getCompany(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

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

export async function createCompany(data: { name: string; logoUrl?: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };
  if (!["super_admin", "admin"].includes(user.platformRole)) {
    return { success: false, error: "Permissão insuficiente" };
  }

  const slug = slugify(data.name);
  const existing = await prisma.company.findUnique({ where: { slug } });
  if (existing) {
    return { success: false, error: "Já existe uma empresa com esse nome" };
  }

  const company = await prisma.company.create({
    data: { name: data.name, slug, logoUrl: data.logoUrl ?? null },
  });

  return { success: true, company };
}

export async function updateCompany(id: string, data: { name?: string; logoUrl?: string; isActive?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };
  if (!["super_admin", "admin"].includes(user.platformRole)) {
    return { success: false, error: "Permissão insuficiente" };
  }

  const company = await prisma.company.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name, slug: slugify(data.name) } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  return { success: true, company };
}

export async function addMember(companyId: string, userId: string, role: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };
  if (!["super_admin", "admin"].includes(user.platformRole)) {
    return { success: false, error: "Permissão insuficiente" };
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
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };
  if (!["super_admin", "admin"].includes(user.platformRole)) {
    return { success: false, error: "Permissão insuficiente" };
  }

  await prisma.userCompanyMembership.update({
    where: { userId_companyId: { userId, companyId } },
    data: { isActive: false },
  });

  return { success: true };
}
