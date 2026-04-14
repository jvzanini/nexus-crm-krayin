export type SegmentOperator = "eq" | "neq" | "in" | "gt" | "lt" | "contains";

export interface SegmentFilter {
  field: string;
  op: SegmentOperator;
  value: unknown;
}

// Allowlist: somente campos nativos de Contact aceitos em 9.0.
const ALLOWED_FIELDS = new Set([
  "email",
  "organization",
  "title",
  "createdAt",
  "consentMarketing",
  "consentTracking",
]);

const DATE_FIELDS = new Set(["createdAt"]);

function convertValue(field: string, value: unknown): unknown {
  if (DATE_FIELDS.has(field) && typeof value === "string") return new Date(value);
  return value;
}

export function buildWhereFromFilters(filters: readonly SegmentFilter[]): {
  AND: Record<string, unknown>[];
} {
  const AND: Record<string, unknown>[] = [];
  for (const f of filters) {
    if (!ALLOWED_FIELDS.has(f.field)) continue;
    const v = convertValue(f.field, f.value);
    switch (f.op) {
      case "eq":
        AND.push({ [f.field]: v });
        break;
      case "neq":
        AND.push({ [f.field]: { not: v } });
        break;
      case "in":
        if (Array.isArray(v)) AND.push({ [f.field]: { in: v } });
        break;
      case "gt":
        AND.push({ [f.field]: { gt: v } });
        break;
      case "lt":
        AND.push({ [f.field]: { lt: v } });
        break;
      case "contains":
        if (typeof v === "string") {
          AND.push({ [f.field]: { contains: v, mode: "insensitive" } });
        }
        break;
    }
  }
  return { AND };
}
