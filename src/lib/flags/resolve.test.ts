import { describe, expect, it } from "vitest";
import { resolveFlag } from "./resolve";
import { bucketOf, inRollout } from "./rollout";

const flag = (patch: Partial<{ enabled: boolean; rolloutPct: number }> = {}) => ({
  key: "X",
  enabled: false,
  rolloutPct: 0,
  ...patch,
});

describe("resolveFlag precedence", () => {
  it("user override vence tudo", () => {
    expect(
      resolveFlag(
        "X",
        flag({ enabled: false, rolloutPct: 100 }),
        [{ key: "X", scope: "user", scopeId: "u1", enabled: true }],
        { userId: "u1", companyId: "c1" },
      ),
    ).toBe(true);
  });

  it("company override vence rollout + enabled global", () => {
    expect(
      resolveFlag(
        "X",
        flag({ enabled: true, rolloutPct: 100 }),
        [{ key: "X", scope: "company", scopeId: "c1", enabled: false }],
        { userId: "u2", companyId: "c1" },
      ),
    ).toBe(false);
  });

  it("rolloutPct=0 + enabled=true → sempre true", () => {
    expect(
      resolveFlag("X", flag({ enabled: true, rolloutPct: 0 }), [], { userId: "u1" }),
    ).toBe(true);
  });

  it("rolloutPct=100 → true p/ qualquer userId", () => {
    expect(
      resolveFlag("X", flag({ enabled: false, rolloutPct: 100 }), [], { userId: "u1" }),
    ).toBe(true);
    expect(
      resolveFlag("X", flag({ enabled: false, rolloutPct: 100 }), [], { userId: "u99" }),
    ).toBe(true);
  });

  it("rolloutPct=50 é determinístico para o mesmo userId", () => {
    const a = resolveFlag("X", flag({ rolloutPct: 50 }), [], { userId: "same" });
    const b = resolveFlag("X", flag({ rolloutPct: 50 }), [], { userId: "same" });
    expect(a).toBe(b);
  });

  it("sem userId e sem override → cai no global", () => {
    expect(resolveFlag("X", flag({ enabled: true, rolloutPct: 50 }), [], {})).toBe(true);
    expect(resolveFlag("X", flag({ enabled: false, rolloutPct: 50 }), [], {})).toBe(false);
  });

  it("flag null → false", () => {
    expect(resolveFlag("X", null, [], { userId: "u1" })).toBe(false);
  });
});

describe("bucketOf/inRollout sanity", () => {
  it("bucket em 0..99", () => {
    for (let i = 0; i < 50; i++) {
      const b = bucketOf("feat-Y", `user-${i}`);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });

  it("distribuição aproximada em 50% sobre 10k amostras", () => {
    let hits = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      if (inRollout("Y", `u${i}`, 50)) hits++;
    }
    const ratio = hits / N;
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.55);
  });
});
