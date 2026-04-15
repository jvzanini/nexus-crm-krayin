/**
 * Formula injection escape — previne execução de fórmulas em Excel/
 * Google Sheets ao abrir CSVs exportados. Prefixa valores cujo primeiro
 * caractere é `=`, `+`, `-`, `@`, tab (`\t`) ou CR (`\r`) com apóstrofo.
 *
 * Referência: OWASP CSV Injection.
 */

const DANGEROUS_PREFIX = /^[=+\-@\t\r]/;

export function escapeFormula<T>(value: T): T | string {
  if (typeof value !== "string") return value;
  if (value.length === 0) return value;
  if (DANGEROUS_PREFIX.test(value)) {
    return `'${value}`;
  }
  return value;
}
