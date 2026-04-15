import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SEARCH_CONFIG, type SearchEntity } from "@/lib/constants/search";
import { requireActiveCompanyId } from "@/lib/tenant-scope";
import { hasPermission } from "@/lib/rbac";
import { normalize } from "@/lib/search/normalize";
import { rankItems } from "@/lib/search/scoring";

export type SearchItemType =
  | "lead"
  | "contact"
  | "opportunity"
  | "product"
  | "task"
  | "workflow"
  | "campaign"
  | "segment"
  | "user"
  | "company";

export interface SearchItem {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  type: SearchItemType;
  score: 50 | 75 | 100;
}

type SearchResponse = Partial<Record<SearchEntity, SearchItem[]>>;

function subjectPluralPath(subjectType: string): string {
  const map: Record<string, string> = {
    lead: "leads",
    contact: "contacts",
    opportunity: "opportunities",
  };
  return map[subjectType.toLowerCase()] ?? "tasks";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < SEARCH_CONFIG.minChars) {
    return NextResponse.json({});
  }

  const normalized = normalize(q);
  const limit = SEARCH_CONFIG.maxResults;

  const isSuperAdmin =
    (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true;

  let tenantFilter: { companyId: string } | Record<string, never> = {};
  if (!isSuperAdmin) {
    try {
      const companyId = await requireActiveCompanyId();
      tenantFilter = { companyId };
    } catch {
      tenantFilter = { companyId: "__no_access__" };
    }
  }

  const [
    canViewLeads,
    canViewContacts,
    canViewOpps,
    canViewProducts,
    canViewActivities,
    canViewAutomation,
    canViewMarketing,
  ] = await Promise.all([
    hasPermission("leads:view"),
    hasPermission("contacts:view"),
    hasPermission("opportunities:view"),
    hasPermission("products:view"),
    hasPermission("activities:view"),
    hasPermission("workflows:view"),
    hasPermission("marketing:view"),
  ]);

  const [
    users,
    companies,
    leads,
    contacts,
    opportunities,
    products,
    tasks,
    workflows,
    campaigns,
    segments,
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: normalized, mode: "insensitive" } },
          { email: { contains: normalized, mode: "insensitive" } },
        ],
        isActive: true,
      },
      select: { id: true, name: true, email: true },
      take: limit * 4,
    }),
    prisma.company.findMany({
      where: { name: { contains: normalized, mode: "insensitive" } },
      select: { id: true, name: true, slug: true },
      take: limit * 4,
    }),
    canViewLeads
      ? prisma.lead.findMany({
          where: {
            ...tenantFilter,
            OR: [
              { name: { contains: normalized, mode: "insensitive" } },
              { email: { contains: normalized, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, email: true, status: true },
          take: limit * 4,
        })
      : Promise.resolve([]),
    canViewContacts
      ? prisma.contact.findMany({
          where: {
            ...tenantFilter,
            OR: [
              { firstName: { contains: normalized, mode: "insensitive" } },
              { lastName: { contains: normalized, mode: "insensitive" } },
              { email: { contains: normalized, mode: "insensitive" } },
            ],
          },
          select: { id: true, firstName: true, lastName: true, email: true },
          take: limit * 4,
        })
      : Promise.resolve([]),
    canViewOpps
      ? prisma.opportunity.findMany({
          where: {
            ...tenantFilter,
            title: { contains: normalized, mode: "insensitive" },
          },
          select: { id: true, title: true, stage: true },
          take: limit * 4,
        })
      : Promise.resolve([]),
    canViewProducts
      ? prisma.product.findMany({
          where: {
            ...tenantFilter,
            OR: [
              { name: { contains: normalized, mode: "insensitive" } },
              { sku: { contains: normalized, mode: "insensitive" } },
            ],
            active: true,
          },
          select: { id: true, name: true, sku: true },
          take: limit * 4,
        })
      : Promise.resolve([]),
    canViewActivities
      ? prisma.activity.findMany({
          where: {
            ...tenantFilter,
            type: { in: ["task", "call", "meeting"] },
            title: { contains: normalized, mode: "insensitive" },
          },
          select: {
            id: true,
            title: true,
            type: true,
            subjectType: true,
            subjectId: true,
          },
          take: limit * 4,
        })
      : Promise.resolve([]),
    canViewAutomation
      ? prisma.workflow.findMany({
          where: {
            ...tenantFilter,
            name: { contains: normalized, mode: "insensitive" },
          },
          select: { id: true, name: true, trigger: true },
          take: limit * 4,
        })
      : Promise.resolve([]),
    canViewMarketing
      ? prisma.campaign.findMany({
          where: {
            ...tenantFilter,
            name: { contains: normalized, mode: "insensitive" },
          },
          select: { id: true, name: true, status: true },
          take: limit * 4,
        })
      : Promise.resolve([]),
    canViewMarketing
      ? prisma.segment.findMany({
          where: {
            ...tenantFilter,
            name: { contains: normalized, mode: "insensitive" },
          },
          select: { id: true, name: true },
          take: limit * 4,
        })
      : Promise.resolve([]),
  ]);

  const response: SearchResponse = {};

  const leadItems = rankItems(
    leads.map((l) => ({ title: l.name, subtitle: l.email ?? l.status, raw: l })),
    normalized,
    limit,
  );
  if (leadItems.length) {
    response.leads = leadItems.map((it) => ({
      id: it.raw.id,
      title: it.title,
      subtitle: it.subtitle,
      href: `/leads/${it.raw.id}`,
      type: "lead",
      score: it.score,
    }));
  }

  const contactItems = rankItems(
    contacts.map((c) => ({
      title: `${c.firstName} ${c.lastName}`.trim(),
      subtitle: c.email,
      raw: c,
    })),
    normalized,
    limit,
  );
  if (contactItems.length) {
    response.contacts = contactItems.map((it) => ({
      id: it.raw.id,
      title: it.title,
      subtitle: it.subtitle,
      href: `/contacts/${it.raw.id}`,
      type: "contact",
      score: it.score,
    }));
  }

  const oppItems = rankItems(
    opportunities.map((o) => ({ title: o.title, subtitle: o.stage, raw: o })),
    normalized,
    limit,
  );
  if (oppItems.length) {
    response.opportunities = oppItems.map((it) => ({
      id: it.raw.id,
      title: it.title,
      subtitle: it.subtitle,
      href: `/opportunities/${it.raw.id}`,
      type: "opportunity",
      score: it.score,
    }));
  }

  const productItems = rankItems(
    products.map((p) => ({ title: p.name, subtitle: p.sku, raw: p })),
    normalized,
    limit,
  );
  if (productItems.length) {
    response.products = productItems.map((it) => ({
      id: it.raw.id,
      title: it.title,
      subtitle: it.subtitle,
      href: "/products",
      type: "product",
      score: it.score,
    }));
  }

  const taskItems = rankItems(
    tasks.map((t) => ({ title: t.title, subtitle: t.type as string, raw: t })),
    normalized,
    limit,
  );
  if (taskItems.length) {
    response.tasks = taskItems.map((it) => {
      const raw = it.raw;
      const href =
        raw.subjectId && raw.subjectType
          ? `/${subjectPluralPath(raw.subjectType as string)}/${raw.subjectId}`
          : "/tasks";
      return {
        id: raw.id,
        title: it.title,
        subtitle: it.subtitle,
        href,
        type: "task",
        score: it.score,
      };
    });
  }

  const workflowItems = rankItems(
    workflows.map((w) => ({ title: w.name, subtitle: w.trigger as string, raw: w })),
    normalized,
    limit,
  );
  if (workflowItems.length) {
    response.workflows = workflowItems.map((it) => ({
      id: it.raw.id,
      title: it.title,
      subtitle: it.subtitle,
      href: "/automation/workflows",
      type: "workflow",
      score: it.score,
    }));
  }

  const campaignItems = rankItems(
    campaigns.map((c) => ({ title: c.name, subtitle: c.status as string, raw: c })),
    normalized,
    limit,
  );
  if (campaignItems.length) {
    response.campaigns = campaignItems.map((it) => ({
      id: it.raw.id,
      title: it.title,
      subtitle: it.subtitle,
      href: "/marketing/campaigns",
      type: "campaign",
      score: it.score,
    }));
  }

  const segmentItems = rankItems(
    segments.map((s) => ({ title: s.name, subtitle: null as string | null, raw: s })),
    normalized,
    limit,
  );
  if (segmentItems.length) {
    response.segments = segmentItems.map((it) => ({
      id: it.raw.id,
      title: it.title,
      subtitle: it.subtitle,
      href: "/marketing/segments",
      type: "segment",
      score: it.score,
    }));
  }

  const userItems = rankItems(
    users.map((u) => ({ title: u.name, subtitle: u.email, raw: u })),
    normalized,
    limit,
  );
  if (userItems.length) {
    response.users = userItems.map((it) => ({
      id: it.raw.id,
      title: it.title,
      subtitle: it.subtitle,
      href: "/users",
      type: "user",
      score: it.score,
    }));
  }

  const companyItems = rankItems(
    companies.map((c) => ({ title: c.name, subtitle: c.slug, raw: c })),
    normalized,
    limit,
  );
  if (companyItems.length) {
    response.companies = companyItems.map((it) => ({
      id: it.raw.id,
      title: it.title,
      subtitle: it.subtitle,
      href: "/companies",
      type: "company",
      score: it.score,
    }));
  }

  return NextResponse.json(response);
}
