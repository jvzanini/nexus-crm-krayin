/**
 * Condition evaluator (puro, zero I/O).
 *
 * Avalia lista de conditions AND (todas devem passar) sobre um payload.
 * Operadores suportados: eq | neq | in | gt | lt | contains.
 *
 * `field` usa dot-path (ex.: "lead.status" ou "status" direto).
 */

export type ConditionOperator = "eq" | "neq" | "in" | "gt" | "lt" | "contains";

export interface Condition {
  field: string;
  op: ConditionOperator;
  value: unknown;
}

function resolveField(payload: unknown, path: string): unknown {
  if (!payload || typeof payload !== "object") return undefined;
  const parts = path.split(".");
  let cur: any = payload;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function cmpEq(actual: unknown, expected: unknown): boolean {
  return actual === expected;
}

function cmpIn(actual: unknown, expected: unknown): boolean {
  if (!Array.isArray(expected)) return false;
  return expected.includes(actual as never);
}

function cmpGt(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "number" && typeof expected === "number") return actual > expected;
  if (actual instanceof Date && expected instanceof Date) return actual.getTime() > expected.getTime();
  if (typeof actual === "string" && typeof expected === "string") return actual > expected;
  return false;
}

function cmpLt(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "number" && typeof expected === "number") return actual < expected;
  if (actual instanceof Date && expected instanceof Date) return actual.getTime() < expected.getTime();
  if (typeof actual === "string" && typeof expected === "string") return actual < expected;
  return false;
}

function cmpContains(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "string" && typeof expected === "string") {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }
  if (Array.isArray(actual)) return actual.includes(expected as never);
  return false;
}

export function evaluateCondition(payload: unknown, cond: Condition): boolean {
  const actual = resolveField(payload, cond.field);
  switch (cond.op) {
    case "eq": return cmpEq(actual, cond.value);
    case "neq": return !cmpEq(actual, cond.value);
    case "in": return cmpIn(actual, cond.value);
    case "gt": return cmpGt(actual, cond.value);
    case "lt": return cmpLt(actual, cond.value);
    case "contains": return cmpContains(actual, cond.value);
    default: return false;
  }
}

/**
 * AND-of-conditions. Array vazio → `true` (sem condições = sempre dispara).
 */
export function evaluateAll(payload: unknown, conditions: readonly Condition[]): boolean {
  return conditions.every((c) => evaluateCondition(payload, c));
}
