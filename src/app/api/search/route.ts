import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SEARCH_CONFIG } from "@/lib/constants/search";

function normalize(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < SEARCH_CONFIG.minChars) {
    return NextResponse.json({ results: [] });
  }

  const normalized = normalize(q);
  const limit = SEARCH_CONFIG.maxResults;

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
      where: {
        name: { contains: normalized, mode: "insensitive" },
      },
      select: { id: true, name: true },
      take: limit,
    }),
    prisma.lead.findMany({
      where: {
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
        title: { contains: normalized, mode: "insensitive" },
      },
      select: { id: true, title: true, stage: true },
      take: limit,
    }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      title: u.name,
      subtitle: u.email,
      href: `/users`,
      type: "user",
    })),
    companies: companies.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: c.name,
      href: `/companies`,
      type: "company",
    })),
    leads: leads.map((l) => ({
      id: l.id,
      title: l.name,
      subtitle: l.email ?? l.status,
      href: `/leads`,
      type: "lead",
    })),
    contacts: contacts.map((c) => ({
      id: c.id,
      title: `${c.firstName} ${c.lastName}`,
      subtitle: c.email ?? "",
      href: `/contacts`,
      type: "contact",
    })),
    opportunities: opportunities.map((o) => ({
      id: o.id,
      title: o.title,
      subtitle: o.stage,
      href: `/opportunities`,
      type: "opportunity",
    })),
  });
}
