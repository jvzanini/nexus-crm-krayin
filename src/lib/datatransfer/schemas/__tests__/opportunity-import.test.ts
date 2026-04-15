import { describe, it, expect } from "vitest";
import { opportunityImportSchema } from "../opportunity-import";

const ctx = {
  locale: { dateFormat: "iso" as const, decimalSep: "." as const },
  customAttrDefs: [],
  lookupStage: (label: string) => {
    const m: Record<string, string> = {
      Prospecting: "prospecting",
      prospecting: "prospecting",
      Proposta: "proposal",
    };
    return m[label] ?? null;
  },
};

describe("opportunityImportSchema", () => {
  it("aceita title + stage + value", async () => {
    const r = await opportunityImportSchema(ctx).safeParseAsync({
      title: "Big deal",
      stage: "Prospecting",
      value: "12345.67",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.stage).toBe("prospecting");
      expect(r.data.value).toBe(12345.67);
    }
  });

  it("rejeita sem title", async () => {
    const r = await opportunityImportSchema(ctx).safeParseAsync({
      stage: "Prospecting",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita stage fora do enum", async () => {
    const r = await opportunityImportSchema(ctx).safeParseAsync({
      title: "x",
      stage: "unknown_stage",
    });
    expect(r.success).toBe(false);
  });
});
