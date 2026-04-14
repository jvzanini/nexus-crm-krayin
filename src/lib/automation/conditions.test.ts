import { describe, expect, it } from "vitest";
import { evaluateAll, evaluateCondition } from "./conditions";
import type { Condition } from "./conditions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const cond = (field: string, op: Condition["op"], value: unknown): Condition => ({ field, op, value });

// ---------------------------------------------------------------------------
// eq
// ---------------------------------------------------------------------------
describe("eq", () => {
  it("string match retorna true", () => {
    expect(evaluateCondition({ status: "new" }, cond("status", "eq", "new"))).toBe(true);
  });

  it("string mismatch retorna false", () => {
    expect(evaluateCondition({ status: "new" }, cond("status", "eq", "old"))).toBe(false);
  });

  it("number match retorna true", () => {
    expect(evaluateCondition({ score: 42 }, cond("score", "eq", 42))).toBe(true);
  });

  it("number mismatch retorna false", () => {
    expect(evaluateCondition({ score: 42 }, cond("score", "eq", 99))).toBe(false);
  });

  it("boolean match retorna true", () => {
    expect(evaluateCondition({ active: true }, cond("active", "eq", true))).toBe(true);
  });

  it("boolean mismatch retorna false", () => {
    expect(evaluateCondition({ active: true }, cond("active", "eq", false))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// neq
// ---------------------------------------------------------------------------
describe("neq", () => {
  it("valores diferentes retorna true", () => {
    expect(evaluateCondition({ status: "new" }, cond("status", "neq", "old"))).toBe(true);
  });

  it("valores iguais retorna false", () => {
    expect(evaluateCondition({ status: "new" }, cond("status", "neq", "new"))).toBe(false);
  });

  it("number neq diferente retorna true", () => {
    expect(evaluateCondition({ n: 1 }, cond("n", "neq", 2))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// in
// ---------------------------------------------------------------------------
describe("in", () => {
  it("valor presente no array retorna true", () => {
    expect(evaluateCondition({ role: "admin" }, cond("role", "in", ["admin", "manager"]))).toBe(true);
  });

  it("valor ausente no array retorna false", () => {
    expect(evaluateCondition({ role: "viewer" }, cond("role", "in", ["admin", "manager"]))).toBe(false);
  });

  it("expected não-array retorna false", () => {
    expect(evaluateCondition({ role: "admin" }, cond("role", "in", "admin"))).toBe(false);
  });

  it("number presente no array retorna true", () => {
    expect(evaluateCondition({ code: 2 }, cond("code", "in", [1, 2, 3]))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// gt
// ---------------------------------------------------------------------------
describe("gt", () => {
  it("number maior retorna true", () => {
    expect(evaluateCondition({ score: 10 }, cond("score", "gt", 5))).toBe(true);
  });

  it("number menor retorna false", () => {
    expect(evaluateCondition({ score: 3 }, cond("score", "gt", 5))).toBe(false);
  });

  it("number igual retorna false", () => {
    expect(evaluateCondition({ score: 5 }, cond("score", "gt", 5))).toBe(false);
  });

  it("date posterior retorna true", () => {
    const d1 = new Date("2026-01-02");
    const d2 = new Date("2026-01-01");
    expect(evaluateCondition({ at: d1 }, cond("at", "gt", d2))).toBe(true);
  });

  it("date anterior retorna false", () => {
    const d1 = new Date("2026-01-01");
    const d2 = new Date("2026-01-02");
    expect(evaluateCondition({ at: d1 }, cond("at", "gt", d2))).toBe(false);
  });

  it("string lexicograficamente maior retorna true", () => {
    expect(evaluateCondition({ s: "b" }, cond("s", "gt", "a"))).toBe(true);
  });

  it("tipo incompatível (string vs number) retorna false", () => {
    expect(evaluateCondition({ s: "10" }, cond("s", "gt", 5))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// lt
// ---------------------------------------------------------------------------
describe("lt", () => {
  it("number menor retorna true", () => {
    expect(evaluateCondition({ score: 3 }, cond("score", "lt", 5))).toBe(true);
  });

  it("number maior retorna false", () => {
    expect(evaluateCondition({ score: 10 }, cond("score", "lt", 5))).toBe(false);
  });

  it("date anterior retorna true", () => {
    const d1 = new Date("2026-01-01");
    const d2 = new Date("2026-01-02");
    expect(evaluateCondition({ at: d1 }, cond("at", "lt", d2))).toBe(true);
  });

  it("string lexicograficamente menor retorna true", () => {
    expect(evaluateCondition({ s: "a" }, cond("s", "lt", "b"))).toBe(true);
  });

  it("tipo incompatível retorna false", () => {
    expect(evaluateCondition({ n: 1 }, cond("n", "lt", "abc"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// contains
// ---------------------------------------------------------------------------
describe("contains", () => {
  it("string case-insensitive match retorna true", () => {
    expect(evaluateCondition({ name: "João Silva" }, cond("name", "contains", "SILVA"))).toBe(true);
  });

  it("string sem match retorna false", () => {
    expect(evaluateCondition({ name: "João Silva" }, cond("name", "contains", "Souza"))).toBe(false);
  });

  it("array contém elemento retorna true", () => {
    expect(evaluateCondition({ tags: ["crm", "lead"] }, cond("tags", "contains", "lead"))).toBe(true);
  });

  it("array não contém elemento retorna false", () => {
    expect(evaluateCondition({ tags: ["crm", "lead"] }, cond("tags", "contains", "opp"))).toBe(false);
  });

  it("tipo incompatível (number) retorna false", () => {
    expect(evaluateCondition({ score: 99 }, cond("score", "contains", "9"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dot-path
// ---------------------------------------------------------------------------
describe("dot-path", () => {
  it("campo aninhado user.profile.name", () => {
    const payload = { user: { profile: { name: "Alice" } } };
    expect(evaluateCondition(payload, cond("user.profile.name", "eq", "Alice"))).toBe(true);
  });

  it("dot-path inexistente → undefined, eq undefined retorna true", () => {
    const payload = { a: 1 };
    expect(evaluateCondition(payload, cond("x.y.z", "eq", undefined))).toBe(true);
  });

  it("dot-path inexistente → undefined, eq valor retorna false", () => {
    const payload = { a: 1 };
    expect(evaluateCondition(payload, cond("x.y", "eq", "foo"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateAll
// ---------------------------------------------------------------------------
describe("evaluateAll", () => {
  it("0 conditions retorna true", () => {
    expect(evaluateAll({ status: "new" }, [])).toBe(true);
  });

  it("3 conditions todas true retorna true", () => {
    const payload = { status: "new", score: 10, name: "Lead" };
    const conditions: Condition[] = [
      cond("status", "eq", "new"),
      cond("score", "gt", 5),
      cond("name", "contains", "Lead"),
    ];
    expect(evaluateAll(payload, conditions)).toBe(true);
  });

  it("1 fail em 3 conditions retorna false", () => {
    const payload = { status: "new", score: 3, name: "Lead" };
    const conditions: Condition[] = [
      cond("status", "eq", "new"),
      cond("score", "gt", 5), // falha
      cond("name", "contains", "Lead"),
    ];
    expect(evaluateAll(payload, conditions)).toBe(false);
  });
});
