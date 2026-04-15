/**
 * Fase 5 — Custom Attributes: tipos compartilhados.
 *
 * Re-exporta enums e models do Prisma Client gerado e define
 * `OPS_BY_TYPE` + `CustomOp` para o filter builder (spec v3 §3.4).
 */

export {
  CustomAttributeEntity,
  CustomAttributeType,
  CustomAttributeStatus,
} from "../../generated/prisma/enums";

export type {
  CustomAttribute,
  CustomAttributeUniqueRef,
} from "../../generated/prisma/client";

/**
 * Operadores de filtro permitidos por tipo de custom attribute.
 *
 * Observações (spec v3):
 * - `contains` em text/url faz seq scan (ILIKE, não usa GIN).
 * - `eq`, `in`, `has_*` usam GIN jsonb_ops.
 */
export const OPS_BY_TYPE = {
  text: ["eq", "in", "contains", "starts", "ends", "is_null"],
  number: ["eq", "in", "gt", "gte", "lt", "lte", "between", "is_null"],
  date: ["eq", "gt", "gte", "lt", "lte", "between", "is_null"],
  datetime: ["eq", "gt", "gte", "lt", "lte", "between", "is_null"],
  boolean: ["eq", "is_null"],
  select: ["eq", "in", "is_null"],
  multi_select: ["has_any", "has_all", "has_none", "is_null"],
  url: ["eq", "in", "contains", "starts", "ends", "is_null"],
} as const;

export type CustomOp =
  | "eq"
  | "in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "contains"
  | "starts"
  | "ends"
  | "has_any"
  | "has_all"
  | "has_none"
  | "is_null";
