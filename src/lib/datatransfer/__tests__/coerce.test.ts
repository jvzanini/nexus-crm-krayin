import { describe, it, expect } from "vitest";
import { dateCoerce, moneyCoerce } from "../coerce";

describe("dateCoerce", () => {
  it("iso happy", () => {
    const r = dateCoerce("iso").safeParse("2026-04-15");
    expect(r.success).toBe(true);
    expect((r as any).data.toISOString().slice(0, 10)).toBe("2026-04-15");
  });
  it("br happy (DD/MM/YYYY)", () => {
    const r = dateCoerce("br").safeParse("15/04/2026");
    expect(r.success).toBe(true);
    expect((r as any).data.toISOString().slice(0, 10)).toBe("2026-04-15");
  });
  it("us happy (MM/DD/YYYY)", () => {
    const r = dateCoerce("us").safeParse("04/15/2026");
    expect(r.success).toBe(true);
    expect((r as any).data.toISOString().slice(0, 10)).toBe("2026-04-15");
  });
  it("br rejeita data ambígua inválida (32/01/2026)", () => {
    expect(dateCoerce("br").safeParse("32/01/2026").success).toBe(false);
  });
  it("us rejeita data ambígua inválida (13/13/2026)", () => {
    expect(dateCoerce("us").safeParse("13/13/2026").success).toBe(false);
  });
  it("iso rejeita lixo", () => {
    expect(dateCoerce("iso").safeParse("not-a-date").success).toBe(false);
  });
});

describe("moneyCoerce", () => {
  it("dot sep '1234.56' → 1234.56", () => {
    const r = moneyCoerce(".").safeParse("1234.56");
    expect(r.success).toBe(true);
    expect((r as any).data).toBe(1234.56);
  });
  it("dot sep com thousands US '1,234.56' → 1234.56", () => {
    const r = moneyCoerce(".").safeParse("1,234.56");
    expect(r.success).toBe(true);
    expect((r as any).data).toBe(1234.56);
  });
  it("comma sep BR '1.234,56' → 1234.56", () => {
    const r = moneyCoerce(",").safeParse("1.234,56");
    expect(r.success).toBe(true);
    expect((r as any).data).toBe(1234.56);
  });
  it("rejeita string não-numérica", () => {
    expect(moneyCoerce(".").safeParse("xyz").success).toBe(false);
  });
});
