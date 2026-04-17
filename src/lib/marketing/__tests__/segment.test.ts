import { describe, it, expect } from "vitest";
import { buildWhereFromFilters, type SegmentFilter } from "../segment";

describe("buildWhereFromFilters", () => {
  it("eq simples", () => {
    const f: SegmentFilter[] = [{ field: "consentMarketing", op: "eq", value: true }];
    expect(buildWhereFromFilters(f)).toEqual({
      AND: [{ consentMarketing: true }],
    });
  });

  it("in em email (array)", () => {
    const f: SegmentFilter[] = [
      { field: "email", op: "in", value: ["a@b.com", "c@d.com"] },
    ];
    expect(buildWhereFromFilters(f)).toEqual({
      AND: [{ email: { in: ["a@b.com", "c@d.com"] } }],
    });
  });

  it("contains em organization é case-insensitive", () => {
    const f: SegmentFilter[] = [
      { field: "organization", op: "contains", value: "acme" },
    ];
    expect(buildWhereFromFilters(f)).toEqual({
      AND: [{ organization: { contains: "acme", mode: "insensitive" } }],
    });
  });

  it("gt em createdAt aceita string ISO", () => {
    const f: SegmentFilter[] = [
      { field: "createdAt", op: "gt", value: "2026-01-01T00:00:00Z" },
    ];
    expect(buildWhereFromFilters(f)).toEqual({
      AND: [{ createdAt: { gt: new Date("2026-01-01T00:00:00Z") } }],
    });
  });

  it("field não permitido é ignorado (defense-in-depth)", () => {
    const f: SegmentFilter[] = [{ field: "password", op: "eq", value: "x" }];
    expect(buildWhereFromFilters(f)).toEqual({ AND: [] });
  });

  it("filtros vazios → AND []", () => {
    expect(buildWhereFromFilters([])).toEqual({ AND: [] });
  });
});
