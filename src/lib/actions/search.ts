"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { SEARCH_CONFIG } from "@/lib/constants/search";
import { requireActiveCompanyId } from "@/lib/tenant-scope";

function normalize(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function search(query: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Não autorizado" };

  const q = query.trim();
  if (q.length < SEARCH_CONFIG.minChars) return { success: true, results: {} };

  const normalized = normalize(q);
  const limit = SEARCH_CONFIG.maxResults;

  // Tenant scope: leads/contacts/opps filtrados por companyId (exceção super_admin).
  // users/companies permanecem globais (super_admin aggregate OK).
  let tenantFilter: { companyId: string } | Record<string, never> = {};
  if (!user.isSuperAdmin) {
    try {
      const companyId = await requireActiveCompanyId();
      tenantFilter = { companyId };
    } catch {
      tenantFilter = { companyId: "__no_access__" }; // força resultado vazio
    }
  }

  const [users, companies, leads, contacts, opportunities] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: normalized, mode: "insensitive" } },
          { email: { contains: normalized, mode: "insensitive" } },
        ],
        isActive: true,
      },
      select: { id: true, name: true, email: true },
      take: limit,
    }),
    prisma.company.findMany({
      where: { name: { contains: normalized, mode: "insensitive" } },
      select: { id: true, name: true },
      take: limit,
    }),
    prisma.lead.findMany({
      where: {
        ...tenantFilter,
        OR: [
          { name: { contains: normalized, mode: "insensitive" } },
          { email: { contains: normalized, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true, status: true },
      take: limit,
    }),
    prisma.contact.findMany({
      where: {
        ...tenantFilter,
        OR: [
          { firstName: { contains: normalized, mode: "insensitive" } },
          { lastName: { contains: normalized, mode: "insensitive" } },
          { email: { contains: normalized, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true },
      take: limit,
    }),
    prisma.opportunity.findMany({
      where: {
        ...tenantFilter,
        title: { contains: normalized, mode: "insensitive" },
      },
      select: { id: true, title: true, stage: true },
      take: limit,
    }),
  ]);

  return {
    success: true,
    results: {
      users,
      companies,
      leads,
      contacts: contacts.map((c) => ({
        ...c,
        name: `${c.firstName} ${c.lastName}`,
      })),
      opportunities,
    },
  };
}
