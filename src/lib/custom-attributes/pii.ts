/**
 * Fase 5 — Custom Attributes: PII redact util (T19/34).
 *
 * Spec v3 §3.9 — DSAR export/erase + logger Pino redact respeitam
 * `piiMasked=true` das defs de CustomAttribute.
 *
 * - `stripPii(custom, defs)`: retorna cópia de `custom` com keys
 *   `piiMasked=true` substituídas por "***REDACTED***".
 * - `getPiiKeys(defs)`: lista keys marcadas `piiMasked=true`, para
 *   gerar paths de redact (Pino) ou para o erase zerar valores.
 *
 * Keys presentes em `custom` mas AUSENTES nas defs são preservadas
 * (unknown → not masked): evita vazamentos por defs desatualizadas
 * quebrarem o export, mas mantém comportamento determinístico.
 */

export const REDACTED_MARKER = "***REDACTED***";

type PiiLikeDef = { key: string; piiMasked: boolean };

/**
 * Retorna lista de keys marcadas `piiMasked=true`.
 */
export function getPiiKeys(defs: readonly PiiLikeDef[] | null | undefined): string[] {
  if (!defs || defs.length === 0) return [];
  return defs.filter((d) => d.piiMasked === true).map((d) => d.key);
}

/**
 * Retorna nova cópia de `custom` onde keys com `piiMasked=true`
 * são substituídas por `"***REDACTED***"`. Non-PII e unknown keys
 * são preservadas. `custom` nulo/indefinido vira `{}`.
 */
export function stripPii(
  custom: Record<string, unknown> | null | undefined,
  defs: readonly PiiLikeDef[] | null | undefined,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(custom ?? {}) };
  const piiKeys = new Set(getPiiKeys(defs));
  if (piiKeys.size === 0) return base;
  for (const key of Object.keys(base)) {
    if (piiKeys.has(key)) base[key] = REDACTED_MARKER;
  }
  return base;
}
