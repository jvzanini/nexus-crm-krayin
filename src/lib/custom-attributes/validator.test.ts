import { describe, expect, it } from "vitest";
import type { CustomAttribute } from "./types";
import { buildZodFromDefinitions } from "./validator";
import { CustomAttrReservedKeyError } from "./limits";

/**
 * Helper: monta um `CustomAttribute` parcial válido para testes.
 * Campos não relevantes para validação recebem defaults fixos.
 */
function def(overrides: Partial<CustomAttribute>): CustomAttribute {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    companyId: "00000000-0000-0000-0000-000000000000",
    entity: "lead",
    key: "field",
    label: "Field",
    type: "text",
    required: false,
    unique: false,
    options: null,
    indexed: false,
    filterable: false,
    searchable: false,
    maxLength: null,
    minValue: null,
    maxValue: null,
    regex: null,
    helpText: null,
    piiMasked: false,
    status: "active",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  } as unknown as CustomAttribute;
}

describe("custom-attributes/validator buildZodFromDefinitions", () => {
  it("text: aceita string dentro de maxLength", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "fullname", type: "text", required: true, maxLength: 10 }),
    ]);
    expect(schema.safeParse({ fullname: "alice" }).success).toBe(true);
  });

  it("text: rejeita string acima de maxLength", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "fullname", type: "text", required: true, maxLength: 3 }),
    ]);
    expect(schema.safeParse({ fullname: "abcd" }).success).toBe(false);
  });

  it("number: aceita number e string numérica (coerce)", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "mrr", type: "number", required: true }),
    ]);
    expect(schema.safeParse({ mrr: 42 }).success).toBe(true);
    expect(schema.safeParse({ mrr: "42" }).success).toBe(true);
  });

  it("number: rejeita string não numérica", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "mrr", type: "number", required: true }),
    ]);
    expect(schema.safeParse({ mrr: "abc" }).success).toBe(false);
  });

  it("date: aceita YYYY-MM-DD e rejeita outros formatos", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "d", type: "date", required: true }),
    ]);
    expect(schema.safeParse({ d: "2026-04-15" }).success).toBe(true);
    expect(schema.safeParse({ d: "15/04/2026" }).success).toBe(false);
    expect(schema.safeParse({ d: "2026-4-1" }).success).toBe(false);
  });

  it("datetime: aceita ISO 8601 e rejeita strings comuns", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "dt", type: "datetime", required: true }),
    ]);
    expect(schema.safeParse({ dt: "2026-04-15T12:34:56Z" }).success).toBe(true);
    expect(schema.safeParse({ dt: "2026-04-15" }).success).toBe(false);
  });

  it("boolean: aceita true/false e rejeita string", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "flag", type: "boolean", required: true }),
    ]);
    expect(schema.safeParse({ flag: true }).success).toBe(true);
    expect(schema.safeParse({ flag: false }).success).toBe(true);
    expect(schema.safeParse({ flag: "true" }).success).toBe(false);
  });

  it("select: aceita valor presente nas options e rejeita outros", () => {
    const schema = buildZodFromDefinitions([
      def({
        key: "tier",
        type: "select",
        required: true,
        options: [
          { value: "gold", label: "Gold" },
          { value: "silver", label: "Silver" },
        ] as unknown as CustomAttribute["options"],
      }),
    ]);
    expect(schema.safeParse({ tier: "gold" }).success).toBe(true);
    expect(schema.safeParse({ tier: "bronze" }).success).toBe(false);
  });

  it("multi_select: aceita array subset das options e rejeita valores fora", () => {
    const schema = buildZodFromDefinitions([
      def({
        key: "tags",
        type: "multi_select",
        required: true,
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
        ] as unknown as CustomAttribute["options"],
      }),
    ]);
    expect(schema.safeParse({ tags: ["a", "c"] }).success).toBe(true);
    expect(schema.safeParse({ tags: [] }).success).toBe(true);
    expect(schema.safeParse({ tags: ["z"] }).success).toBe(false);
  });

  it("url: aceita URL válida e rejeita string solta", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "site", type: "url", required: true }),
    ]);
    expect(schema.safeParse({ site: "https://example.com" }).success).toBe(
      true,
    );
    expect(schema.safeParse({ site: "not a url" }).success).toBe(false);
  });

  it("required=false permite omitir ou passar null", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "note", type: "text", required: false, maxLength: 50 }),
    ]);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ note: null }).success).toBe(true);
    expect(schema.safeParse({ note: "oi" }).success).toBe(true);
  });

  it("required=true rejeita ausência", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "fullname", type: "text", required: true, maxLength: 10 }),
    ]);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("strict mode: rejeita keys não definidas", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "fullname", type: "text", required: true, maxLength: 10 }),
    ]);
    const result = schema.safeParse({ fullname: "ok", extra: "bad" });
    expect(result.success).toBe(false);
  });

  it("piiMasked=true NÃO afeta validação (só logging) — valor passa normalmente", () => {
    // piiMasked é flag para redact em logs, não altera shape/validação.
    const schema = buildZodFromDefinitions([
      def({
        key: "cpf",
        type: "text",
        required: true,
        maxLength: 14,
        piiMasked: true,
      }),
    ]);
    expect(schema.safeParse({ cpf: "12345678900" }).success).toBe(true);
  });

  it("reserved key: lança CustomAttrReservedKeyError ao montar schema", () => {
    expect(() =>
      buildZodFromDefinitions([
        def({ key: "email", type: "text", required: true, maxLength: 100 }),
      ]),
    ).toThrow(CustomAttrReservedKeyError);
  });

  it("select sem options válidas: lança erro", () => {
    expect(() =>
      buildZodFromDefinitions([
        def({ key: "tier", type: "select", required: true, options: null }),
      ]),
    ).toThrow();
  });

  it("multi_select com options shape inválido: lança erro", () => {
    expect(() =>
      buildZodFromDefinitions([
        def({
          key: "tags",
          type: "multi_select",
          required: true,
          options: [
            { foo: "bar" },
          ] as unknown as CustomAttribute["options"],
        }),
      ]),
    ).toThrow();
  });

  it("compõe múltiplas defs em um único object schema", () => {
    const schema = buildZodFromDefinitions([
      def({ key: "fullname", type: "text", required: true, maxLength: 20 }),
      def({ key: "mrr", type: "number", required: false }),
    ]);
    expect(schema.safeParse({ fullname: "Alice", mrr: 100 }).success).toBe(
      true,
    );
    expect(schema.safeParse({ fullname: "Alice" }).success).toBe(true);
    expect(schema.safeParse({ mrr: 100 }).success).toBe(false);
  });
});
