/**
 * Fase 5 — Custom Attributes: naming util para unique indexes shared
 * por (entity, key) (spec v3 §3.3 / plan v3 T3.5).
 *
 * PostgreSQL limita nomes de objects em 63 chars (NAMEDATALEN-1).
 * Se `idx_${entity}_custom_${key}_unique` exceder, trunca e apende hash
 * curto derivado do nome bruto para preservar unicidade e idempotência.
 */

import { createHash } from "node:crypto";

const MAX_PG_IDENT_LENGTH = 63;
const HASH_SUFFIX_LENGTH = 6;

function hash6(input: string): string {
  return createHash("sha1")
    .update(input)
    .digest("hex")
    .slice(0, HASH_SUFFIX_LENGTH);
}

/**
 * Retorna o nome do unique index para (entity, key). Idempotente:
 * mesma input sempre produz o mesmo nome.
 *
 * Exemplos:
 *   ("lead", "cpf") → "idx_lead_custom_cpf_unique"           (25 chars — ok)
 *   ("opportunity", "a".repeat(60)) → "idx_opportunity_custom_aaaa..._c3b2a1"
 *     (truncado em 60 + "_" + hash6 = 67? — ver algoritmo)
 *
 * Algoritmo: se raw <= 63 → retorna raw. Caso contrário, retorna
 * `raw.slice(0, 60 - HASH_SUFFIX_LENGTH - 1) + "_" + hash6(raw)` para
 * caber exatamente em 63 chars, preservando prefixo legível.
 */
export function buildUniqueIndexName(entity: string, key: string): string {
  const raw = `idx_${entity}_custom_${key}_unique`;
  if (raw.length <= MAX_PG_IDENT_LENGTH) {
    return raw;
  }
  const suffix = `_${hash6(raw)}`; // 7 chars (_ + 6 hex)
  const prefixLen = MAX_PG_IDENT_LENGTH - suffix.length;
  return raw.slice(0, prefixLen) + suffix;
}
