/**
 * Fase 5 — T6: Parser de filtros custom a partir de URLSearchParams.
 *
 * Suporta duas sintaxes (spec v3 §3.6):
 *   - Bracket:    `cf[key][op]=value`
 *   - Underscore: `cf_key_op=value` (greedy reverse match sobre o sufixo).
 *
 * IM-6 (regressão): `cf_total_eq_value_eq=5` deve ser interpretado como
 * `{ key: "total_eq_value", op: "eq", value: "5" }`. O match do op é feito
 * pelo sufixo, priorizando operadores mais longos primeiro (reverse greedy).
 *
 * Caps (spec v3 §3.10):
 *   - MAX_FILTER_VALUES (50) por lista CSV.
 *   - MAX_FILTER_VALUE_LENGTH (256) por valor (scalar ou elemento CSV).
 *   - MAX_CONCURRENT_FILTERS (5) por request.
 */

import {
  MAX_CONCURRENT_FILTERS,
  MAX_FILTER_VALUE_LENGTH,
  MAX_FILTER_VALUES,
} from "../custom-attributes/limits.constants";
import type { CustomOp } from "../custom-attributes/types";

const VALID_OPS = [
  "eq",
  "in",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "contains",
  "starts",
  "ends",
  "has_any",
  "has_all",
  "has_none",
  "is_null",
] as const satisfies readonly CustomOp[];

/** Ordenado por length DESC para garantir greedy reverse match. */
const OPS_DESC_BY_LENGTH = [...VALID_OPS].sort(
  (a, b) => b.length - a.length,
);

const VALID_OPS_SET = new Set<string>(VALID_OPS);

/** Ops cujo value é uma lista CSV. */
const LIST_OPS = new Set<CustomOp>([
  "in",
  "between",
  "has_any",
  "has_all",
  "has_none",
]);

const KEY_REGEX = /^[a-z][a-z0-9_]{0,79}$/;
const BRACKET_REGEX = /^cf\[([a-z][a-z0-9_]{0,79})\]\[([a-z_]+)\]$/;

export interface ParsedCustomFilter {
  key: string;
  op: CustomOp;
  value: unknown;
}

function capString(s: string): string {
  return s.length > MAX_FILTER_VALUE_LENGTH
    ? s.slice(0, MAX_FILTER_VALUE_LENGTH)
    : s;
}

function coerceValue(op: CustomOp, raw: string): unknown {
  if (LIST_OPS.has(op)) {
    const parts = raw
      .split(",")
      .slice(0, MAX_FILTER_VALUES)
      .map((p) => capString(p));
    return parts;
  }
  return capString(raw);
}

function matchUnderscore(
  param: string,
): { key: string; op: CustomOp } | null {
  if (!param.startsWith("cf_")) return null;
  const rest = param.slice(3);
  // Greedy reverse: tenta op mais longo primeiro como sufixo após '_'.
  for (const op of OPS_DESC_BY_LENGTH) {
    const suffix = `_${op}`;
    if (rest.endsWith(suffix)) {
      const key = rest.slice(0, rest.length - suffix.length);
      if (key.length === 0) continue;
      return { key, op };
    }
  }
  return null;
}

export function parseCustomFiltersFromSearchParams(
  searchParams: URLSearchParams,
): ParsedCustomFilter[] {
  const out: ParsedCustomFilter[] = [];

  for (const [param, rawValue] of searchParams.entries()) {
    if (out.length >= MAX_CONCURRENT_FILTERS) break;
    if (!param.startsWith("cf")) continue;

    let key: string | null = null;
    let op: CustomOp | null = null;

    const bracket = BRACKET_REGEX.exec(param);
    if (bracket) {
      key = bracket[1]!;
      const maybeOp = bracket[2]!;
      if (VALID_OPS_SET.has(maybeOp)) {
        op = maybeOp as CustomOp;
      }
    } else {
      const u = matchUnderscore(param);
      if (u) {
        key = u.key;
        op = u.op;
      }
    }

    if (!key || !op) continue;
    if (!KEY_REGEX.test(key)) continue;

    out.push({ key, op, value: coerceValue(op, rawValue) });
  }

  return out;
}
