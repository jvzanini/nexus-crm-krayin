// Multi-tenant helpers — wrapper delega ao @nexusai360/multi-tenant.
// Bug fix incluso: hierarquia do pacote cobre super_admin (antes omitido no local).
import { prisma } from "@/lib/prisma";
import {
  getCompanyAdapter,
  getUserCompanyRole as getUserCompanyRolePure,
  hasCompanyPermission,
  type CompanyRole,
} from "@nexusai360/multi-tenant";

export type { CompanyRole };

export async function getUserCompanyRole(
  userId: string,
  companyId: string,
): Promise<CompanyRole | null> {
  const memberships = await getCompanyAdapter().listMembershipsByUser(userId);
  return getUserCompanyRolePure(userId, companyId, memberships);
}

export async function requireCompanyRole(
  userId: string,
  companyId: string,
  minRole: CompanyRole,
): Promise<boolean> {
  const role = await getUserCompanyRole(userId, companyId);
  if (!role) return false;
  return hasCompanyPermission(role, minRole);
}

/**
 * Mantém Prisma direto — adapter retorna MembershipRecord sem company embed.
 * Refactor para builders do pacote fica para frente seguinte.
 */
export async function getUserCompanies(userId: string) {
  return prisma.userCompanyMembership.findMany({
    where: { userId, isActive: true },
    include: { company: true },
    orderBy: { company: { name: "asc" } },
  });
}
