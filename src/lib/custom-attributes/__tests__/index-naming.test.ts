import { describe, expect, it } from "vitest";
import { buildUniqueIndexName } from "../index-naming";

describe("custom-attributes/index-naming", () => {
  it("retorna nome raw quando <= 63 chars", () => {
    expect(buildUniqueIndexName("lead", "cpf")).toBe(
      "idx_lead_custom_cpf_unique",
    );
    expect(buildUniqueIndexName("opportunity", "mrr")).toBe(
      "idx_opportunity_custom_mrr_unique",
    );
  });

  it("trunca e apende hash6 quando excede 63 chars", () => {
    const longKey = "a".repeat(80);
    const name = buildUniqueIndexName("opportunity", longKey);
    expect(name.length).toBeLessThanOrEqual(63);
    expect(name.startsWith("idx_opportunity_custom_")).toBe(true);
    // Sufixo termina com _<6 hex>
    expect(name).toMatch(/_[0-9a-f]{6}$/);
  });

  it("é idempotente — mesma input sempre gera o mesmo nome", () => {
    const k = "super_long_custom_attribute_key_" + "x".repeat(50);
    const n1 = buildUniqueIndexName("contact", k);
    const n2 = buildUniqueIndexName("contact", k);
    expect(n1).toBe(n2);
    // Keys diferentes geram hashes diferentes mesmo com prefixo igual.
    const n3 = buildUniqueIndexName("contact", k + "z");
    expect(n3).not.toBe(n1);
    expect(n3.length).toBeLessThanOrEqual(63);
  });
});
