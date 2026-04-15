import { describe, it, expect } from "vitest";
import { contactImportSchema } from "../contact-import";

const ctx = {
  locale: { dateFormat: "iso" as const, decimalSep: "." as const },
  customAttrDefs: [],
};

describe("contactImportSchema", () => {
  it("aceita firstName+lastName válidos", () => {
    const r = contactImportSchema(ctx).safeParse({
      firstName: "Alice",
      lastName: "Smith",
      email: "a@x.com",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita sem firstName", () => {
    const r = contactImportSchema(ctx).safeParse({ lastName: "Smith" });
    expect(r.success).toBe(false);
  });

  it("rejeita sem lastName", () => {
    const r = contactImportSchema(ctx).safeParse({ firstName: "Alice" });
    expect(r.success).toBe(false);
  });

  it("aceita sem email (opcional)", () => {
    const r = contactImportSchema(ctx).safeParse({
      firstName: "Bob",
      lastName: "Jones",
    });
    expect(r.success).toBe(true);
  });
});
