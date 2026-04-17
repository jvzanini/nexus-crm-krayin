import { describe, it, expect } from "vitest";
import {
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
  currencyLabel,
  type Currency,
} from "../allowlist";

describe("currency/allowlist", () => {
  describe("SUPPORTED_CURRENCIES", () => {
    it("deve ter no mínimo 10 moedas suportadas", () => {
      expect(SUPPORTED_CURRENCIES.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("isSupportedCurrency", () => {
    it("deve retornar true para BRL", () => {
      expect(isSupportedCurrency("BRL")).toBe(true);
    });

    it("deve retornar true para todas as moedas da allowlist", () => {
      SUPPORTED_CURRENCIES.forEach((currency) => {
        expect(isSupportedCurrency(currency)).toBe(true);
      });
    });

    it("deve retornar false para moedas não suportadas", () => {
      expect(isSupportedCurrency("XYZ")).toBe(false);
      expect(isSupportedCurrency("INR")).toBe(false);
      expect(isSupportedCurrency("CNY")).toBe(false);
    });

    it("deve ser case-sensitive (lowercase não é válido)", () => {
      expect(isSupportedCurrency("brl")).toBe(false);
      expect(isSupportedCurrency("usd")).toBe(false);
      expect(isSupportedCurrency("eur")).toBe(false);
    });

    it("deve retornar false para string vazia", () => {
      expect(isSupportedCurrency("")).toBe(false);
    });
  });

  describe("currencyLabel", () => {
    it("deve retornar string não-vazia para USD", () => {
      const label = currencyLabel("USD");
      expect(label).toBeTruthy();
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    });

    it("deve incluir o código da moeda no label para USD", () => {
      const label = currencyLabel("USD");
      expect(label).toContain("USD");
    });

    it("deve retornar labels diferentes para moedas diferentes", () => {
      const brlLabel = currencyLabel("BRL");
      const usdLabel = currencyLabel("USD");
      expect(brlLabel).not.toBe(usdLabel);
    });

    it("deve ter labels definidas para todas as moedas suportadas", () => {
      SUPPORTED_CURRENCIES.forEach((currency) => {
        const label = currencyLabel(currency);
        expect(label).toBeTruthy();
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
        expect(label).toContain(currency);
      });
    });

    it("deve retornar label para BRL contendo 'Real'", () => {
      const label = currencyLabel("BRL");
      expect(label).toContain("Real");
    });

    it("deve retornar label para EUR contendo 'Euro'", () => {
      const label = currencyLabel("EUR");
      expect(label).toContain("Euro");
    });
  });

  describe("Coerção de tipos", () => {
    it("isSupportedCurrency deve agir como type guard", () => {
      const code: string = "BRL";
      if (isSupportedCurrency(code)) {
        // TypeScript deve reconhecer code como Currency aqui
        const label: string = currencyLabel(code);
        expect(label).toBeTruthy();
      }
    });
  });
});
