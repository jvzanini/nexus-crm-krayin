import { describe, it, expect } from "vitest";
import { leadImportSchema } from "../lead-import";

const ctx = {
  locale: { dateFormat: "iso" as const, decimalSep: "." as const },
  customAttrDefs: [],
  lookupOwner: async (_: string) => null,
  lookupStatus: (label: string) => {
    const m: Record<string, string> = {
      Novo: "new",
      new: "new",
      Contatado: "contacted",
      Qualificado: "qualified",
    };
    return m[label] ?? null;
  },
};

describe("leadImportSchema", () => {
  it("aceita lead com name + email válidos", async () => {
    const schema = leadImportSchema(ctx);
    const r = await schema.safeParseAsync({
      name: "Alice",
      email: "a@x.com",
      status: "Novo",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Alice");
      expect(r.data.status).toBe("new");
    }
  });

  it("rejeita quando name ausente", async () => {
    const schema = leadImportSchema(ctx);
    const r = await schema.safeParseAsync({ email: "x@y.com" });
    expect(r.success).toBe(false);
  });

  it("rejeita email inválido", async () => {
    const schema = leadImportSchema(ctx);
    const r = await schema.safeParseAsync({ name: "Bob", email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("rejeita status fora do enum", async () => {
    const schema = leadImportSchema(ctx);
    const r = await schema.safeParseAsync({ name: "Carol", status: "ZZZZ" });
    expect(r.success).toBe(false);
  });
});
