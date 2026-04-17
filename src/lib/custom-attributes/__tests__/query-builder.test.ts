/**
 * Fase 5 — Custom Attributes: query-builder tests (T5/34).
 * Spec v3 §3.4 — allowlist OPS_BY_TYPE + mapeamento Prisma JSON filters.
 */
import { describe, expect, it } from "vitest";
import {
  buildPrismaWhereFromCustomFilters,
  InvalidOperatorError,
  type CustomFilter,
} from "../query-builder";
import type { CustomAttribute } from "../types";

/**
 * Factory minimal de CustomAttribute para os testes. Só os campos usados
 * pelo query-builder são necessários; cast para CustomAttribute satisfaz o
 * tipo gerado pelo Prisma.
 */
function def(
  key: string,
  type: CustomAttribute["type"],
  overrides: Partial<CustomAttribute> = {},
): CustomAttribute {
  return {
    id: `id-${key}`,
    companyId: "company-1",
    entity: "lead",
    key,
    label: key,
    type,
    required: false,
    isUnique: false,
    placeholder: null,
    helpText: null,
    minLength: null,
    maxLength: null,
    minValue: null,
    maxValue: null,
    pattern: null,
    options: null,
    defaultValue: null,
    position: 0,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as CustomAttribute;
}

describe("custom-attributes/query-builder", () => {
  describe("allowlist enforcement", () => {
    it("lança InvalidOperatorError quando op não está em OPS_BY_TYPE[type]", () => {
      const defs = [def("mrr", "number")];
      expect(() =>
        buildPrismaWhereFromCustomFilters(
          [{ key: "mrr", op: "contains", value: "x" }],
          defs,
        ),
      ).toThrow(InvalidOperatorError);
    });

    it("lança InvalidOperatorError para boolean com op gt", () => {
      const defs = [def("active", "boolean")];
      expect(() =>
        buildPrismaWhereFromCustomFilters(
          [{ key: "active", op: "gt", value: true }],
          defs,
        ),
      ).toThrow(InvalidOperatorError);
    });

    it("lança InvalidOperatorError para multi_select com op eq", () => {
      const defs = [def("tags", "multi_select")];
      expect(() =>
        buildPrismaWhereFromCustomFilters(
          [{ key: "tags", op: "eq", value: "a" }],
          defs,
        ),
      ).toThrow(InvalidOperatorError);
    });
  });

  describe("def não encontrada → skip", () => {
    it("retorna null quando filter aponta para key inexistente", () => {
      const defs = [def("mrr", "number")];
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "naoexiste", op: "eq", value: 1 }],
        defs,
      );
      expect(result).toBeNull();
    });

    it("retorna null quando filters vazios", () => {
      expect(buildPrismaWhereFromCustomFilters([], [])).toBeNull();
    });
  });

  describe("text type", () => {
    const defs = [def("descricao", "text")];

    it("eq → path + equals", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "descricao", op: "eq", value: "hello" }],
        defs,
      );
      expect(result).toEqual({
        AND: [{ path: ["descricao"], equals: "hello" }],
      });
    });

    it("contains → string_contains + mode insensitive", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "descricao", op: "contains", value: "abc" }],
        defs,
      );
      expect(result).toEqual({
        AND: [
          {
            path: ["descricao"],
            string_contains: "abc",
            mode: "insensitive",
          },
        ],
      });
    });

    it("starts → string_starts_with", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "descricao", op: "starts", value: "pre" }],
        defs,
      );
      expect(result).toEqual({
        AND: [{ path: ["descricao"], string_starts_with: "pre" }],
      });
    });

    it("ends → string_ends_with", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "descricao", op: "ends", value: "suf" }],
        defs,
      );
      expect(result).toEqual({
        AND: [{ path: ["descricao"], string_ends_with: "suf" }],
      });
    });

    it("in → OR de path equals", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "descricao", op: "in", value: ["a", "b", "c"] }],
        defs,
      );
      expect(result).toEqual({
        AND: [
          {
            OR: [
              { path: ["descricao"], equals: "a" },
              { path: ["descricao"], equals: "b" },
              { path: ["descricao"], equals: "c" },
            ],
          },
        ],
      });
    });
  });

  describe("number type", () => {
    const defs = [def("mrr", "number")];

    it("gt → path + gt", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "mrr", op: "gt", value: 100 }],
        defs,
      );
      expect(result).toEqual({ AND: [{ path: ["mrr"], gt: 100 }] });
    });

    it("gte / lt / lte geram comparators equivalentes", () => {
      expect(
        buildPrismaWhereFromCustomFilters(
          [{ key: "mrr", op: "gte", value: 1 }],
          defs,
        ),
      ).toEqual({ AND: [{ path: ["mrr"], gte: 1 }] });
      expect(
        buildPrismaWhereFromCustomFilters(
          [{ key: "mrr", op: "lt", value: 2 }],
          defs,
        ),
      ).toEqual({ AND: [{ path: ["mrr"], lt: 2 }] });
      expect(
        buildPrismaWhereFromCustomFilters(
          [{ key: "mrr", op: "lte", value: 3 }],
          defs,
        ),
      ).toEqual({ AND: [{ path: ["mrr"], lte: 3 }] });
    });

    it("between → AND de gte + lte", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "mrr", op: "between", value: [100, 500] }],
        defs,
      );
      expect(result).toEqual({
        AND: [
          {
            AND: [
              { path: ["mrr"], gte: 100 },
              { path: ["mrr"], lte: 500 },
            ],
          },
        ],
      });
    });

    it("between lança erro se value não for array de 2", () => {
      expect(() =>
        buildPrismaWhereFromCustomFilters(
          [{ key: "mrr", op: "between", value: [1] }],
          defs,
        ),
      ).toThrow();
      expect(() =>
        buildPrismaWhereFromCustomFilters(
          [{ key: "mrr", op: "between", value: [1, 2, 3] }],
          defs,
        ),
      ).toThrow();
    });
  });

  describe("boolean type", () => {
    const defs = [def("ativo", "boolean")];

    it("eq true", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "ativo", op: "eq", value: true }],
        defs,
      );
      expect(result).toEqual({
        AND: [{ path: ["ativo"], equals: true }],
      });
    });
  });

  describe("multi_select type", () => {
    const defs = [def("tags", "multi_select")];

    it("has_any → array_contains com todos os valores", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "tags", op: "has_any", value: ["a", "b"] }],
        defs,
      );
      expect(result).toEqual({
        AND: [
          {
            OR: [
              { path: ["tags"], array_contains: ["a"] },
              { path: ["tags"], array_contains: ["b"] },
            ],
          },
        ],
      });
    });

    it("has_all → AND de array_contains por valor", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "tags", op: "has_all", value: ["a", "b"] }],
        defs,
      );
      expect(result).toEqual({
        AND: [
          {
            AND: [
              { path: ["tags"], array_contains: ["a"] },
              { path: ["tags"], array_contains: ["b"] },
            ],
          },
        ],
      });
    });

    it("has_none → NOT de OR(array_contains)", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "tags", op: "has_none", value: ["a", "b"] }],
        defs,
      );
      expect(result).toEqual({
        AND: [
          {
            NOT: {
              OR: [
                { path: ["tags"], array_contains: ["a"] },
                { path: ["tags"], array_contains: ["b"] },
              ],
            },
          },
        ],
      });
    });

    it("has_any aceita até 50 valores", () => {
      const values = Array.from({ length: 50 }, (_, i) => `v${i}`);
      expect(() =>
        buildPrismaWhereFromCustomFilters(
          [{ key: "tags", op: "has_any", value: values }],
          defs,
        ),
      ).not.toThrow();
    });

    it("has_any lança erro se > 50 valores", () => {
      const values = Array.from({ length: 51 }, (_, i) => `v${i}`);
      expect(() =>
        buildPrismaWhereFromCustomFilters(
          [{ key: "tags", op: "has_any", value: values }],
          defs,
        ),
      ).toThrow();
    });
  });

  describe("is_null", () => {
    it("boolean is_null → NOT { path, not: AnyNull }", () => {
      const defs = [def("flag", "boolean")];
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "flag", op: "is_null", value: null }],
        defs,
      );
      // Estrutura: AND de NOT{ path, not: JsonNull/AnyNull-like }.
      // Validamos estrutura relativa — não comparamos AnyNull literal pois é símbolo runtime Prisma.
      expect(result).toHaveProperty("AND");
      const inner = (result as { AND: unknown[] }).AND[0] as {
        NOT: { path: string[] };
      };
      expect(inner.NOT.path).toEqual(["flag"]);
      expect(inner.NOT).toHaveProperty("not");
    });
  });

  describe("select type", () => {
    const defs = [def("stage", "select")];
    it("in com múltiplos valores", () => {
      const result = buildPrismaWhereFromCustomFilters(
        [{ key: "stage", op: "in", value: ["open", "won"] }],
        defs,
      );
      expect(result).toEqual({
        AND: [
          {
            OR: [
              { path: ["stage"], equals: "open" },
              { path: ["stage"], equals: "won" },
            ],
          },
        ],
      });
    });

    it("in lança erro se > 50 valores", () => {
      const values = Array.from({ length: 51 }, (_, i) => `v${i}`);
      expect(() =>
        buildPrismaWhereFromCustomFilters(
          [{ key: "stage", op: "in", value: values }],
          defs,
        ),
      ).toThrow();
    });
  });

  describe("combinação múltiplos filters", () => {
    it("múltiplos filters → AND por fora", () => {
      const defs = [def("mrr", "number"), def("stage", "select")];
      const result = buildPrismaWhereFromCustomFilters(
        [
          { key: "mrr", op: "gte", value: 100 },
          { key: "stage", op: "eq", value: "open" },
        ],
        defs,
      );
      expect(result).toEqual({
        AND: [
          { path: ["mrr"], gte: 100 },
          { path: ["stage"], equals: "open" },
        ],
      });
    });

    it("skip de defs inexistentes mas inclui os válidos", () => {
      const defs = [def("mrr", "number")];
      const result = buildPrismaWhereFromCustomFilters(
        [
          { key: "naoexiste", op: "eq", value: "x" } as CustomFilter,
          { key: "mrr", op: "eq", value: 100 },
        ],
        defs,
      );
      expect(result).toEqual({
        AND: [{ path: ["mrr"], equals: 100 }],
      });
    });
  });

  describe("date / datetime type", () => {
    it("date between", () => {
      const defs = [def("vencimento", "date")];
      const result = buildPrismaWhereFromCustomFilters(
        [
          {
            key: "vencimento",
            op: "between",
            value: ["2026-01-01", "2026-12-31"],
          },
        ],
        defs,
      );
      expect(result).toEqual({
        AND: [
          {
            AND: [
              { path: ["vencimento"], gte: "2026-01-01" },
              { path: ["vencimento"], lte: "2026-12-31" },
            ],
          },
        ],
      });
    });
  });
});
