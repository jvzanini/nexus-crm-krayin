import { describe, it, expect } from "vitest";
import {
  createSegmentSchema,
  updateSegmentSchema,
  previewSegmentSchema,
  SEGMENT_OPERATORS,
} from "./marketing-segments-schemas";

describe("createSegmentSchema", () => {
  it("rejeita name vazio", () => {
    const result = createSegmentSchema.safeParse({ name: "", filters: [] });
    expect(result.success).toBe(false);
  });

  it("rejeita name com mais de 200 chars", () => {
    const result = createSegmentSchema.safeParse({ name: "a".repeat(201), filters: [] });
    expect(result.success).toBe(false);
  });

  it("rejeita mais de 20 filtros", () => {
    const filters = Array.from({ length: 21 }, () => ({
      field: "email",
      op: "eq",
      value: "x@x.com",
    }));
    const result = createSegmentSchema.safeParse({ name: "Teste", filters });
    expect(result.success).toBe(false);
  });

  it("rejeita op inválido", () => {
    const result = createSegmentSchema.safeParse({
      name: "Teste",
      filters: [{ field: "email", op: "like", value: "x" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita field vazio", () => {
    const result = createSegmentSchema.safeParse({
      name: "Teste",
      filters: [{ field: "", op: "eq", value: "x" }],
    });
    expect(result.success).toBe(false);
  });

  it("aceita segmento válido com filtros", () => {
    const result = createSegmentSchema.safeParse({
      name: "Leads consentidos",
      description: "Segmento de teste",
      filters: [{ field: "consentMarketing", op: "eq", value: true }],
    });
    expect(result.success).toBe(true);
  });

  it("aceita filtros vazios", () => {
    const result = createSegmentSchema.safeParse({ name: "Todos", filters: [] });
    expect(result.success).toBe(true);
  });
});

describe("updateSegmentSchema", () => {
  it("aceita patch parcial sem name", () => {
    const result = updateSegmentSchema.safeParse({ filters: [] });
    expect(result.success).toBe(true);
  });

  it("rejeita description acima de 2000 chars", () => {
    const result = updateSegmentSchema.safeParse({ description: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });
});

describe("previewSegmentSchema", () => {
  it("rejeita mais de 20 filtros", () => {
    const filters = Array.from({ length: 21 }, () => ({
      field: "email",
      op: "eq",
      value: "x@x.com",
    }));
    const result = previewSegmentSchema.safeParse({ filters });
    expect(result.success).toBe(false);
  });
});

describe("SEGMENT_OPERATORS", () => {
  it("contém os 6 operadores esperados", () => {
    expect(SEGMENT_OPERATORS).toEqual(["eq", "neq", "in", "gt", "lt", "contains"]);
  });
});
