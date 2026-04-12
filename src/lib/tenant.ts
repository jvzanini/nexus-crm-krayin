// Multi-tenant helpers
import { prisma } from "@/lib/prisma";
import { CompanyRole } from "@/generated/prisma/client";

/**
 * Retorna o papel de um usuário em uma empresa específica, ou null se não membro.
 */
export async function getUserCompanyRole(
  userId: string,
  companyId: string
): Promise<CompanyRole | null> {
  const membership = await prisma.userCompanyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership || !membership.isActive) return null;
  return membership.role;
}

/**
 * Verifica se o usuário tem pelo menos o role exigido na empresa.
 */
export async function requireCompanyRole(
  userId: string,
  companyId: string,
  minRole: CompanyRole
): Promise<boolean> {
  const ROLE_HIERARCHY: Record<CompanyRole, number> = {
    super_admin: 4,
    company_admin: 3,
    manager: 2,
    viewer: 1,
  };

  const role = await getUserCompanyRole(userId, companyId);
  if (!role) return false;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

/**
 * Retorna todas as empresas ativas de um usuário.
 */
export async function getUserCompanies(userId: string) {
  return prisma.userCompanyMembership.findMany({
    where: { userId, isActive: true },
    include: { company: true },
    orderBy: { company: { name: "asc" } },
  });
}
