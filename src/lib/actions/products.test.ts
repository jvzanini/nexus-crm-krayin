/**
 * Testes de validação pura dos schemas de products actions.
 * Não testam integração com DB — apenas regras de validação (SKU, currency, amount).
 */
import { describe, expect, it } from "vitest";
import { isSupportedCurrency } from "@/lib/currency/allowlist";

// ---------------------------------------------------------------------------
// Helpers de validação local (replica a lógica dos schemas do action)
// ---------------------------------------------------------------------------

function validateSku(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "SKU deve ser string" };
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.length < 1) return { ok: false, error: "SKU obrigatório" };
  if (trimmed.length > 64) return { ok: false, error: "SKU deve ter no máximo 64 caracteres" };
  if (!/^[A-Z0-9_-]+$/.test(trimmed)) {
    return { ok: false, error: "SKU deve conter apenas letras, números, hífens e underscores" };
  }
  return { ok: true, value: trimmed };
}

function validateCurrency(code: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof code !== "string" || !isSupportedCurrency(code)) {
    return { ok: false, error: "Moeda não suportada" };
  }
  return { ok: true };
}

const MAX_AMOUNT = 9_999_999_999.9999;

function validateAmount(
  raw: unknown
): { ok: true; value: number } | { ok: false; error: string } {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(n)) return { ok: false, error: "Valor inválido" };
  if (n < 0) return { ok: false, error: "Valor não pode ser negativo" };
  if (n > MAX_AMOUNT) return { ok: false, error: "Valor excede o limite máximo" };
  return { ok: true, value: n };
}

// ---------------------------------------------------------------------------
// SKU
// ---------------------------------------------------------------------------

describe("SKU — normalização e validação", () => {
  it("transforma para maiúsculas e remove espaços laterais", () => {
    const result = validateSku("  prod-01  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("PROD-01");
  });

  it("aceita SKU com letras, números, hífen e underscore", () => {
    const result = validateSku("ABC_123-XYZ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("ABC_123-XYZ");
  });

  it("rejeita SKU vazio", () => {
    const result = validateSku("");
    expect(result.ok).toBe(false);
  });

  it("rejeita SKU com caracteres especiais inválidos (@)", () => {
    const result = validateSku("PROD@01");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("letras, números, hífens e underscores");
  });

  it("rejeita SKU com espaço interno", () => {
    const result = validateSku("PROD 01");
    expect(result.ok).toBe(false);
  });

  it("rejeita SKU com mais de 64 caracteres", () => {
    const longSku = "A".repeat(65);
    const result = validateSku(longSku);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("64");
  });

  it("aceita SKU com exatamente 64 caracteres", () => {
    const sku64 = "A".repeat(64);
    const result = validateSku(sku64);
    expect(result.ok).toBe(true);
  });

  it("rejeita SKU com ponto (.)", () => {
    const result = validateSku("PROD.01");
    expect(result.ok).toBe(false);
  });

  it("aceita SKU numérico puro", () => {
    const result = validateSku("12345");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("12345");
  });
});

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

describe("Currency — moedas suportadas", () => {
  it("aceita BRL", () => {
    expect(validateCurrency("BRL").ok).toBe(true);
  });

  it("aceita USD", () => {
    expect(validateCurrency("USD").ok).toBe(true);
  });

  it("aceita EUR", () => {
    expect(validateCurrency("EUR").ok).toBe(true);
  });

  it("aceita GBP", () => {
    expect(validateCurrency("GBP").ok).toBe(true);
  });

  it("rejeita moeda inexistente XYZ", () => {
    const result = validateCurrency("XYZ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Moeda não suportada");
  });

  it("rejeita string vazia", () => {
    const result = validateCurrency("");
    expect(result.ok).toBe(false);
  });

  it("rejeita moeda em lowercase (brl)", () => {
    const result = validateCurrency("brl");
    expect(result.ok).toBe(false);
  });

  it("rejeita moeda em mixed case (Brl)", () => {
    const result = validateCurrency("Brl");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Amount
// ---------------------------------------------------------------------------

describe("Amount — valores monetários", () => {
  it("aceita zero", () => {
    const result = validateAmount(0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it("aceita valor positivo como número", () => {
    const result = validateAmount(99.99);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(99.99);
  });

  it("aceita valor positivo como string", () => {
    const result = validateAmount("1500.50");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(1500.5);
  });

  it("rejeita valor negativo", () => {
    const result = validateAmount(-1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Valor não pode ser negativo");
  });

  it("rejeita string negativa", () => {
    const result = validateAmount("-100");
    expect(result.ok).toBe(false);
  });

  it("rejeita valor acima do limite máximo", () => {
    const result = validateAmount(99_999_999_999);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Valor excede o limite máximo");
  });

  it("aceita valor no limite máximo", () => {
    const result = validateAmount(9_999_999_999.9999);
    expect(result.ok).toBe(true);
  });

  it("rejeita string não numérica", () => {
    const result = validateAmount("abc");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Valor inválido");
  });

  it("rejeita NaN", () => {
    const result = validateAmount(NaN);
    expect(result.ok).toBe(false);
  });
});
