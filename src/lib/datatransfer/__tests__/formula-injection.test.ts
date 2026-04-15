import { describe, it, expect } from "vitest";
import { escapeFormula } from "../formula-injection";

describe("escapeFormula", () => {
  it("prefixa = com apóstrofo", () => {
    expect(escapeFormula("=SUM(A1)")).toBe("'=SUM(A1)");
  });
  it("prefixa + com apóstrofo", () => {
    expect(escapeFormula("+2+3")).toBe("'+2+3");
  });
  it("prefixa - com apóstrofo", () => {
    expect(escapeFormula("-5")).toBe("'-5");
  });
  it("prefixa @ com apóstrofo", () => {
    expect(escapeFormula("@foo")).toBe("'@foo");
  });
  it("prefixa tab com apóstrofo", () => {
    expect(escapeFormula("\tdanger")).toBe("'\tdanger");
  });
  it("prefixa CR com apóstrofo", () => {
    expect(escapeFormula("\rhidden")).toBe("'\rhidden");
  });
  it("não mexe em strings seguras", () => {
    expect(escapeFormula("hello")).toBe("hello");
    expect(escapeFormula("1abc")).toBe("1abc");
  });
  it("passthrough para valores não-string", () => {
    expect(escapeFormula(42)).toBe(42);
    expect(escapeFormula(null)).toBe(null);
    expect(escapeFormula(undefined)).toBe(undefined);
  });
});
