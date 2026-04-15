import { describe, it, expect } from "vitest";
import { suggestMapping, similarity } from "../mapping";

describe("similarity", () => {
  it("idêntico = 1", () => {
    expect(similarity("email", "email")).toBe(1);
  });
  it("totalmente diferente < 0.4", () => {
    expect(similarity("abc", "xyzwq")).toBeLessThan(0.4);
  });
});

describe("suggestMapping", () => {
  const fields = ["firstName", "lastName", "email", "phone", "company"];

  it("retorna top 3 sugestões para cada coluna", () => {
    const r = suggestMapping(["first_name"], fields);
    expect(r.first_name).toBeDefined();
    expect(r.first_name.length).toBeLessThanOrEqual(3);
    expect(r.first_name[0]!.field).toBe("firstName");
    expect(r.first_name[0]!.score).toBeGreaterThanOrEqual(0.7);
  });

  it("filtra matches com ratio < 0.7", () => {
    const r = suggestMapping(["xyz_qq"], fields);
    expect(r.xyz_qq.every((m) => m.score >= 0.7)).toBe(true);
  });

  it("retorna array vazio quando coluna não tem match", () => {
    const r = suggestMapping(["zzzzzz"], fields);
    expect(r.zzzzzz).toEqual([]);
  });

  it("tie-break determinístico (ordem alfabética por field)", () => {
    // Duas cols iguais: mesmo score — nos dois casos deve ser idêntico output.
    const r1 = suggestMapping(["mail"], fields);
    const r2 = suggestMapping(["mail"], fields);
    expect(r1.mail.map((m) => m.field)).toEqual(r2.mail.map((m) => m.field));
  });

  it("retorna {} para input vazio", () => {
    expect(suggestMapping([], fields)).toEqual({});
  });
});
