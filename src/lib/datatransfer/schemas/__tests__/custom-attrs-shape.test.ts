import { describe, it, expect } from "vitest";
import { dynamicCustomShape, type CustomAttrSnapshot } from "../custom-attrs-shape";

describe("dynamicCustomShape", () => {
  it("aceita campos text required + number opcional", () => {
    const snapshot: CustomAttrSnapshot[] = [
      {
        key: "industry",
        type: "text",
        required: true,
        minLength: null,
        maxLength: null,
        options: null,
      },
      {
        key: "revenue",
        type: "number",
        required: false,
        minLength: null,
        maxLength: null,
        options: null,
      },
    ];
    const schema = dynamicCustomShape(snapshot);
    const ok = schema.safeParse({ industry: "Tech", revenue: "1000" });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.revenue).toBe(1000);
    }
  });

  it("rejeita campo required vazio + valida select contra options", () => {
    const snapshot: CustomAttrSnapshot[] = [
      {
        key: "tier",
        type: "select",
        required: true,
        minLength: null,
        maxLength: null,
        options: ["gold", "silver"],
      },
    ];
    const schema = dynamicCustomShape(snapshot);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ tier: "bronze" }).success).toBe(false);
    expect(schema.safeParse({ tier: "gold" }).success).toBe(true);
  });
});
