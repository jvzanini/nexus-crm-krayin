import type { PrismaClient } from "@/generated/prisma/client";
import type { Entity } from "./types";

export interface LookupContextArgs {
  prisma: PrismaClient;
  companyId: string;
  entity: Entity;
}

export interface LookupContext {
  lookupOwner(labelOrEmail: string): Promise<string | null>;
  lookupStatus(label: string): string | null;
  lookupStage(label: string): string | null;
  lookupProduct(sku: string): Promise<string | null>;
}

const LEAD_STATUS_MAP: Record<string, string> = {
  // EN
  new: "new",
  contacted: "contacted",
  qualified: "qualified",
  unqualified: "unqualified",
  converted: "converted",
  // PT
  novo: "new",
  contatado: "contacted",
  qualificado: "qualified",
  "não qualificado": "unqualified",
  nao_qualificado: "unqualified",
  convertido: "converted",
};

const OPP_STAGE_MAP: Record<string, string> = {
  prospecting: "prospecting",
  qualification: "qualification",
  proposal: "proposal",
  negotiation: "negotiation",
  closed_won: "closed_won",
  closed_lost: "closed_lost",
  // PT
  prospectando: "prospecting",
  qualificação: "qualification",
  qualificacao: "qualification",
  proposta: "proposal",
  negociação: "negotiation",
  negociacao: "negotiation",
  ganho: "closed_won",
  perdido: "closed_lost",
};

/**
 * Cria contexto de lookup com cache por job. `lookupOwner` e
 * `lookupProduct` pre-fetcham 1x e mantêm Map em memória. `lookupStatus`
 * e `lookupStage` são puros (tabelas estáticas label→enum).
 */
export function createLookupContext(args: LookupContextArgs): LookupContext {
  const { prisma, companyId, entity } = args;
  let userCache: Map<string, string> | null = null;
  let productCache: Map<string, string> | null = null;

  async function getUsers(): Promise<Map<string, string>> {
    if (userCache) return userCache;
    const users = (await (
      prisma as unknown as {
        user: {
          findMany: (a: {
            where: { memberships: { some: { companyId: string } } };
            select: { id: true; name: true; email: true };
          }) => Promise<{ id: string; name: string; email: string }[]>;
        };
      }
    ).user.findMany({
      where: { memberships: { some: { companyId } } },
      select: { id: true, name: true, email: true },
    })) as { id: string; name: string; email: string }[];
    const m = new Map<string, string>();
    for (const u of users) {
      m.set(u.email.toLowerCase(), u.id);
      m.set(u.name.toLowerCase(), u.id);
    }
    userCache = m;
    return m;
  }

  async function getProducts(): Promise<Map<string, string>> {
    if (productCache) return productCache;
    const rows = (await (
      prisma as unknown as {
        product: {
          findMany: (a: {
            where: { companyId: string };
            select: { id: true; sku: true };
          }) => Promise<{ id: string; sku: string }[]>;
        };
      }
    ).product.findMany({
      where: { companyId },
      select: { id: true, sku: true },
    })) as { id: string; sku: string }[];
    const m = new Map<string, string>();
    for (const p of rows) m.set(p.sku.toLowerCase(), p.id);
    productCache = m;
    return m;
  }

  return {
    async lookupOwner(labelOrEmail: string) {
      const m = await getUsers();
      return m.get(labelOrEmail.toLowerCase()) ?? null;
    },
    lookupStatus(label: string) {
      if (entity !== "lead") return null;
      return LEAD_STATUS_MAP[label.toLowerCase().trim()] ?? null;
    },
    lookupStage(label: string) {
      if (entity !== "opportunity") return null;
      return OPP_STAGE_MAP[label.toLowerCase().trim()] ?? null;
    },
    async lookupProduct(sku: string) {
      const m = await getProducts();
      return m.get(sku.toLowerCase()) ?? null;
    },
  };
}
