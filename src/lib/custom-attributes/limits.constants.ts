/**
 * Fase 5 — Custom Attributes: constantes puras de limites.
 *
 * Este módulo existe separado de `limits.ts` para que código client-safe
 * (ex.: `src/lib/filters/custom-parser.ts` importado por components client)
 * possa consumir as constantes sem arrastar `prisma` na cadeia de módulos.
 *
 * Spec v3 §3.10.
 */

export const MAX_ATTRS_PER_ENTITY = 30;
export const MAX_CUSTOM_BYTES_PER_ROW = 32 * 1024;
export const MAX_FILTER_VALUES = 50;
export const MAX_FILTER_VALUE_LENGTH = 256;
export const MAX_CONCURRENT_FILTERS = 5;

/**
 * Keys reservadas (colisão com colunas reais ou risco semântico).
 */
export const RESERVED_KEYS = [
  "id",
  "company_id",
  "companyId",
  "created_at",
  "createdAt",
  "updated_at",
  "updatedAt",
  "email",
  "name",
  "phone",
  "status",
  "stage",
  "custom",
  "__proto__",
  "constructor",
  "prototype",
] as const;

export type ReservedKey = (typeof RESERVED_KEYS)[number];
