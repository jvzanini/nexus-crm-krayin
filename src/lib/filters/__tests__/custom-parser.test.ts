/**
 * Fase 5 — T6 custom-parser URL.
 *
 * Cobre:
 * - Formato bracket `cf[key][op]=value`
 * - Formato underscore `cf_key_op=value` com greedy reverse match (IM-6).
 * - CSV em `in`/`between`/`has_*`.
 * - Caps MAX_FILTER_VALUES (50), MAX_FILTER_VALUE_LENGTH (256),
 *   MAX_CONCURRENT_FILTERS (5).
 * - Keys/ops inválidas → skip.
 */

import { describe, expect, it } from "vitest";
import { parseCustomFiltersFromSearchParams } from "../custom-parser";

function sp(qs: string): URLSearchParams {
  return new URLSearchParams(qs);
}

describe("parseCustomFiltersFromSearchParams", () => {
  it("parses bracket format cf[mrr][gte]=1000", () => {
    const out = parseCustomFiltersFromSearchParams(sp("cf[mrr][gte]=1000"));
    expect(out).toEqual([{ key: "mrr", op: "gte", value: "1000" }]);
  });

  it("parses underscore format cf_mrr_gte=1000", () => {
    const out = parseCustomFiltersFromSearchParams(sp("cf_mrr_gte=1000"));
    expect(out).toEqual([{ key: "mrr", op: "gte", value: "1000" }]);
  });

  it("IM-6 regression: greedy reverse match cf_total_eq_value_eq=5", () => {
    // key contém 'eq' literal no meio; parser deve pegar o ÚLTIMO op como sufixo.
    const out = parseCustomFiltersFromSearchParams(
      sp("cf_total_eq_value_eq=5"),
    );
    expect(out).toEqual([
      { key: "total_eq_value", op: "eq", value: "5" },
    ]);
  });

  it("parses multiple filters combined (bracket + underscore)", () => {
    const out = parseCustomFiltersFromSearchParams(
      sp("cf[mrr][gte]=1000&cf_status_eq=active"),
    );
    expect(out).toHaveLength(2);
    expect(out).toContainEqual({ key: "mrr", op: "gte", value: "1000" });
    expect(out).toContainEqual({ key: "status", op: "eq", value: "active" });
  });

  it("splits CSV for `in` op: cf[tags][in]=vip,lead", () => {
    const out = parseCustomFiltersFromSearchParams(sp("cf[tags][in]=vip,lead"));
    expect(out).toEqual([
      { key: "tags", op: "in", value: ["vip", "lead"] },
    ]);
  });

  it("splits CSV for `between` op: cf[v][between]=100,500", () => {
    const out = parseCustomFiltersFromSearchParams(
      sp("cf[v][between]=100,500"),
    );
    expect(out).toEqual([
      { key: "v", op: "between", value: ["100", "500"] },
    ]);
  });

  it("splits CSV for `has_any`/`has_all`/`has_none`", () => {
    const out = parseCustomFiltersFromSearchParams(
      sp("cf[tags][has_any]=a,b,c"),
    );
    expect(out).toEqual([
      { key: "tags", op: "has_any", value: ["a", "b", "c"] },
    ]);
  });

  it("caps CSV values at MAX_FILTER_VALUES (50)", () => {
    const csv = Array.from({ length: 60 }, (_, i) => `v${i}`).join(",");
    const out = parseCustomFiltersFromSearchParams(sp(`cf[tags][in]=${csv}`));
    expect(out).toHaveLength(1);
    expect(Array.isArray(out[0]!.value)).toBe(true);
    expect((out[0]!.value as string[]).length).toBe(50);
  });

  it("caps individual CSV value at MAX_FILTER_VALUE_LENGTH (256 chars)", () => {
    const long = "x".repeat(300);
    const short = "ok";
    const out = parseCustomFiltersFromSearchParams(
      sp(`cf[tags][in]=${long},${short}`),
    );
    expect(out).toHaveLength(1);
    const values = out[0]!.value as string[];
    expect(values).toHaveLength(2);
    expect(values[0]!.length).toBe(256);
    expect(values[1]).toBe("ok");
  });

  it("caps scalar value at MAX_FILTER_VALUE_LENGTH (256 chars)", () => {
    const long = "y".repeat(400);
    const out = parseCustomFiltersFromSearchParams(
      sp(`cf[name][eq]=${long}`),
    );
    expect(out).toHaveLength(1);
    expect((out[0]!.value as string).length).toBe(256);
  });

  it("caps total filters at MAX_CONCURRENT_FILTERS (5)", () => {
    const qs = Array.from({ length: 8 }, (_, i) => `cf[k${i}][eq]=v`).join("&");
    const out = parseCustomFiltersFromSearchParams(sp(qs));
    expect(out).toHaveLength(5);
  });

  it("skips invalid key (doesn't match KEY_REGEX)", () => {
    const out = parseCustomFiltersFromSearchParams(
      sp("cf[1bad][eq]=x&cf[Bad][eq]=y&cf[ok_key][eq]=z"),
    );
    expect(out).toEqual([{ key: "ok_key", op: "eq", value: "z" }]);
  });

  it("skips invalid op", () => {
    const out = parseCustomFiltersFromSearchParams(
      sp("cf[mrr][weird]=1&cf[mrr][eq]=2"),
    );
    expect(out).toEqual([{ key: "mrr", op: "eq", value: "2" }]);
  });

  it("ignores params that don't start with cf", () => {
    const out = parseCustomFiltersFromSearchParams(
      sp("page=2&sort=name&cf[mrr][eq]=1"),
    );
    expect(out).toEqual([{ key: "mrr", op: "eq", value: "1" }]);
  });

  it("underscore format also splits CSV for list ops", () => {
    const out = parseCustomFiltersFromSearchParams(sp("cf_tags_in=a,b"));
    expect(out).toEqual([{ key: "tags", op: "in", value: ["a", "b"] }]);
  });

  it("skips underscore format with no valid op suffix", () => {
    const out = parseCustomFiltersFromSearchParams(sp("cf_justkey=1"));
    expect(out).toEqual([]);
  });
});
