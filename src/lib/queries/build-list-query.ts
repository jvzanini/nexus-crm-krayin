import { tenantWhere } from "@/lib/tenant-scope";

export type ListEntity = "lead" | "contact" | "opportunity" | "product";

export interface BuildListQueryCtx {
  companyId: string;
  user?: { isSuperAdmin: boolean };
  allowSuperAdminBypass?: boolean;
}

export interface BuildListQueryInput {
  filters?: Record<string, unknown>;
  sort?: { field: string; dir: "asc" | "desc" };
  page?: { limit?: number; cursor?: string };
}

export interface BuildListQueryOutput {
  where: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc">;
  take?: number;
  skip?: number;
  cursor?: { id: string };
}

/**
 * Constrói args canônicos de `findMany` para entidades scoped por
 * tenant. Responsabilidades:
 *
 * 1. **Tenant enforcement**: sempre injeta `companyId` no `where`,
 *    exceto quando `allowSuperAdminBypass=true` E user is super_admin.
 * 2. **Filters whitelist**: passa através campos conhecidos (status,
 *    stage, category, source, active, q). Não injeta operadores
 *    arbitrários.
 * 3. **Sort**: aplica `orderBy`; default `createdAt desc`.
 * 4. **Page**: aplica `take` (limit clamp 1..500).
 */
export function buildListQuery<E extends ListEntity>(
  entity: E,
  input: BuildListQueryInput,
  ctx: BuildListQueryCtx,
): BuildListQueryOutput {
  const tenantPart = tenantWhere(ctx.companyId, {
    user: ctx.user,
    allowSuperAdminBypass: ctx.allowSuperAdminBypass,
  });

  const where: Record<string, unknown> = { ...tenantPart };
  const filters = input.filters ?? {};

  // Whitelist per-entity.
  const allowed: Record<ListEntity, string[]> = {
    lead: ["status", "source", "assignedTo"],
    contact: ["organization"],
    opportunity: ["stage", "assignedTo"],
    product: ["active", "category"],
  };
  for (const key of allowed[entity] ?? []) {
    const v = filters[key];
    if (v !== undefined && v !== null && v !== "") {
      where[key] = v;
    }
  }

  // Free-text search `q` — entidade-specific mapping.
  const q = typeof filters.q === "string" && filters.q.length > 0 ? filters.q : null;
  if (q) {
    if (entity === "lead") {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    } else if (entity === "contact") {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    } else if (entity === "opportunity") {
      where.OR = [{ title: { contains: q, mode: "insensitive" } }];
    } else if (entity === "product") {
      where.OR = [
        { sku: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }
  }

  // Date range `from`/`to` → createdAt.
  const from =
    typeof filters.from === "string" && filters.from.length > 0 ? filters.from : null;
  const to =
    typeof filters.to === "string" && filters.to.length > 0 ? filters.to : null;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) range.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) range.lte = d;
    }
    if (Object.keys(range).length > 0) where.createdAt = range;
  }

  const sortField = input.sort?.field ?? "createdAt";
  const sortDir = input.sort?.dir ?? "desc";
  const orderBy: Record<string, "asc" | "desc"> = { [sortField]: sortDir };

  const limit = input.page?.limit ?? 50;
  const take = Math.max(1, Math.min(limit, 500));

  const result: BuildListQueryOutput = { where, orderBy, take };
  if (input.page?.cursor) {
    result.cursor = { id: input.page.cursor };
    result.skip = 1;
  }
  return result;
}
