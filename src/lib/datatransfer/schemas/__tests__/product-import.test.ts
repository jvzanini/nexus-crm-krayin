import { describe, it, expect } from "vitest";
import { productImportSchema } from "../product-import";

const ctx = {
  locale: { dateFormat: "iso" as const, decimalSep: "." as const },
};

describe("productImportSchema", () => {
  it("aceita sku + name válidos", () => {
    const r = productImportSchema(ctx).safeParse({
      sku: "SKU-001",
      name: "Widget",
      active: "true",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.active).toBe(true);
  });

  it("rejeita sem sku", () => {
    const r = productImportSchema(ctx).safeParse({ name: "No sku" });
    expect(r.success).toBe(false);
  });

  it("rejeita sem name", () => {
    const r = productImportSchema(ctx).safeParse({ sku: "SKU-xx" });
    expect(r.success).toBe(false);
  });
});
