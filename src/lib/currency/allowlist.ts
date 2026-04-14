/**
 * Allowlist de moedas suportadas (ISO-4217).
 * Ampliar requer decisão de negócio + migration de dados; NÃO configurável em env.
 */
export const SUPPORTED_CURRENCIES = [
  "BRL", "USD", "EUR", "GBP",
  "ARS", "CLP", "MXN", "CAD",
  "AUD", "JPY",
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(code: string): code is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

const LABELS: Record<Currency, string> = {
  BRL: "Real brasileiro (BRL)",
  USD: "Dólar americano (USD)",
  EUR: "Euro (EUR)",
  GBP: "Libra esterlina (GBP)",
  ARS: "Peso argentino (ARS)",
  CLP: "Peso chileno (CLP)",
  MXN: "Peso mexicano (MXN)",
  CAD: "Dólar canadense (CAD)",
  AUD: "Dólar australiano (AUD)",
  JPY: "Iene japonês (JPY)",
};

export function currencyLabel(code: Currency): string {
  return LABELS[code];
}
