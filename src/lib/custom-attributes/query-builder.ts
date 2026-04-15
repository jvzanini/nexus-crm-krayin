/**
 * Fase 5 — Custom Attributes: query-builder (T5/34).
 *
 * Spec v3 §3.4 — Mapeia filtros `cf[key][op]=value` em Prisma JSON filters
 * sobre a coluna `custom`. Valida op contra `OPS_BY_TYPE[def.type]` antes de
 * gerar o filter; op fora da allowlist lança `InvalidOperatorError`.
 *
 * Retorno: `{ AND: [...] }` com um entry por filter válido, ou `null` quando
 * nenhum filter produz output (ex.: todos apontam para defs inexistentes).
 *
 * O caller monta `where.custom = buildPrismaWhereFromCustomFilters(...)`.
 */
import { Prisma } from "../../generated/prisma/client";
import { MAX_FILTER_VALUES } from "./limits";
import { OPS_BY_TYPE, type CustomAttribute, type CustomOp } from "./types";

export type CustomFilter = {
  key: string;
  op: CustomOp;
  value: unknown;
};

export class InvalidOperatorError extends Error {
  constructor(
    public op: string,
    public type: string,
  ) {
    super(`operador "${op}" não permitido para tipo "${type}"`);
    this.name = "InvalidOperatorError";
  }
}

export class InvalidFilterValueError extends Error {
  constructor(
    public op: string,
    public reason: string,
  ) {
    super(`filter inválido op="${op}": ${reason}`);
    this.name = "InvalidFilterValueError";
  }
}

function assertOpAllowed(op: CustomOp, def: CustomAttribute): void {
  const allowed = OPS_BY_TYPE[def.type as keyof typeof OPS_BY_TYPE] as
    | readonly string[]
    | undefined;
  if (!allowed || !allowed.includes(op)) {
    throw new InvalidOperatorError(op, String(def.type));
  }
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new InvalidFilterValueError("in/has_*", "valor deve ser array");
}

function assertMaxValues(values: unknown[], op: string): void {
  if (values.length > MAX_FILTER_VALUES) {
    throw new InvalidFilterValueError(
      op,
      `máximo ${MAX_FILTER_VALUES} valores permitidos (got ${values.length})`,
    );
  }
}

function buildOne(filter: CustomFilter): Record<string, unknown> {
  const { key, op, value } = filter;
  const path = [key];

  switch (op) {
    case "eq":
      return { path, equals: value };

    case "gt":
      return { path, gt: value };
    case "gte":
      return { path, gte: value };
    case "lt":
      return { path, lt: value };
    case "lte":
      return { path, lte: value };

    case "contains":
      return { path, string_contains: value, mode: "insensitive" };
    case "starts":
      return { path, string_starts_with: value };
    case "ends":
      return { path, string_ends_with: value };

    case "in": {
      const values = toArray(value);
      assertMaxValues(values, "in");
      return {
        OR: values.map((v) => ({ path, equals: v })),
      };
    }

    case "between": {
      const values = toArray(value);
      if (values.length !== 2) {
        throw new InvalidFilterValueError(
          "between",
          "esperado exatamente 2 valores",
        );
      }
      const [lo, hi] = values;
      return {
        AND: [
          { path, gte: lo },
          { path, lte: hi },
        ],
      };
    }

    case "has_any": {
      const values = toArray(value);
      assertMaxValues(values, "has_any");
      return {
        OR: values.map((v) => ({ path, array_contains: [v] })),
      };
    }

    case "has_all": {
      const values = toArray(value);
      assertMaxValues(values, "has_all");
      return {
        AND: values.map((v) => ({ path, array_contains: [v] })),
      };
    }

    case "has_none": {
      const values = toArray(value);
      assertMaxValues(values, "has_none");
      return {
        NOT: {
          OR: values.map((v) => ({ path, array_contains: [v] })),
        },
      };
    }

    case "is_null":
      return {
        NOT: { path, not: Prisma.AnyNull },
      };
  }
}

/**
 * Constrói `where.custom` para Prisma a partir de filtros estruturados.
 *
 * - Filters cujo `key` não tem `def` correspondente são ignorados (skip).
 * - Op fora de `OPS_BY_TYPE[def.type]` lança `InvalidOperatorError`.
 * - Retorna `null` quando nada válido sobra.
 */
export function buildPrismaWhereFromCustomFilters(
  filters: Array<CustomFilter>,
  defs: CustomAttribute[],
): { AND: Record<string, unknown>[] } | null {
  if (filters.length === 0) return null;

  const byKey = new Map<string, CustomAttribute>();
  for (const d of defs) byKey.set(d.key, d);

  const parts: Record<string, unknown>[] = [];
  for (const filter of filters) {
    const def = byKey.get(filter.key);
    if (!def) continue;
    assertOpAllowed(filter.op, def);
    parts.push(buildOne(filter));
  }

  if (parts.length === 0) return null;
  return { AND: parts };
}
