import levenshtein from "fast-levenshtein";

/** Levenshtein ratio normalizado: 1 = idêntico, 0 = totalmente diferente. */
export function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[_\-\s]/g, "");
  const A = norm(a);
  const B = norm(b);
  if (A === B) return 1;
  const maxLen = Math.max(A.length, B.length);
  if (maxLen === 0) return 0;
  const dist = levenshtein.get(A, B);
  return 1 - dist / maxLen;
}

export interface MappingSuggestion {
  field: string;
  score: number;
}

/**
 * Sugere mapeamento de colunas do CSV para campos canônicos via
 * Levenshtein ratio. Retorna top 3 matches com score ≥ 0.7 por coluna.
 * Ordem: score desc, depois field asc (tie-break determinístico).
 */
export function suggestMapping(
  columns: string[],
  fields: string[],
): Record<string, MappingSuggestion[]> {
  const out: Record<string, MappingSuggestion[]> = {};
  for (const col of columns) {
    const scored = fields
      .map((field) => ({ field, score: similarity(col, field) }))
      .filter((s) => s.score >= 0.7)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.field.localeCompare(b.field);
      })
      .slice(0, 3);
    out[col] = scored;
  }
  return out;
}
