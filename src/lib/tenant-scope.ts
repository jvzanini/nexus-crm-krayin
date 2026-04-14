// Tenant scoping helpers — Frente 17.
// Resolve activeCompanyId da sessão e fornece filters prontos para Prisma.
//
// Regra: toda query em Lead/Contact/Opportunity PRECISA filtrar por companyId.
// super_admin bypass: opt-in explícito via flag `{ allowSuperAdminBypass: true }`.

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export class NoActiveCompanyError extends Error {
  constructor() {
    super("no_active_company");
    this.name = "NoActiveCompanyError";
  }
}

/**
 * Resolve o companyId da primeira membership ativa do usuário autenticado.
 * Lança `NoActiveCompanyError` se não houver user ou membership.
 *
 * Super admin ainda precisa de membership explícita para operar em escopo
 * de tenant — o bypass é decidido no callsite (ex.: dashboards globais).
 */
export async function requireActiveCompanyId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new NoActiveCompanyError();

  const membership = await prisma.userCompanyMembership.findFirst({
    where: { userId: user.id, isActive: true },
    select: { companyId: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) throw new NoActiveCompanyError();
  return membership.companyId;
}

/**
 * Retorna o user atual + companyId ativo de uma vez. Útil para actions
 * que precisam de ambos (RBAC check + tenant filter).
 */
export async function requireUserAndCompany(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  companyId: string;
}> {
  const user = await getCurrentUser();
  if (!user) throw new NoActiveCompanyError();

  const membership = await prisma.userCompanyMembership.findFirst({
    where: { userId: user.id, isActive: true },
    select: { companyId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new NoActiveCompanyError();
  return { user, companyId: membership.companyId };
}

/**
 * Filter compatível com Prisma `where: { ...filter }`.
 * - Caso comum: `{ companyId: activeCompanyId }`.
 * - Com `allowSuperAdminBypass` e user isSuperAdmin → `{}` (sem restrição).
 */
export function tenantWhere(
  activeCompanyId: string,
  opts?: { user?: { isSuperAdmin: boolean }; allowSuperAdminBypass?: boolean },
): { companyId: string } | Record<string, never> {
  if (opts?.allowSuperAdminBypass && opts.user?.isSuperAdmin) {
    return {};
  }
  return { companyId: activeCompanyId };
}
