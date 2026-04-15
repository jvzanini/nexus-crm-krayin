import { normalize } from "./normalize";

export type MatchScore = 0 | 50 | 75 | 100;

export function scoreMatch(
  value: string | null | undefined,
  normalizedQuery: string,
): MatchScore {
  if (!value || !normalizedQuery) return 0;
  const v = normalize(value);
  if (v === normalizedQuery) return 100;
  if (v.startsWith(normalizedQuery)) return 75;
  if (v.includes(normalizedQuery)) return 50;
  return 0;
}

export interface RankableItem {
  title: string;
  subtitle: string | null;
}

export function rankItems<T extends RankableItem>(
  items: T[],
  normalizedQuery: string,
  limit: number = 5,
): Array<T & { score: 50 | 75 | 100 }> {
  const scored: Array<T & { score: MatchScore }> = items.map((it) => ({
    ...it,
    score: Math.max(
      scoreMatch(it.title, normalizedQuery),
      scoreMatch(it.subtitle, normalizedQuery),
    ) as MatchScore,
  }));
  const filtered = scored.filter(
    (it): it is T & { score: 50 | 75 | 100 } => it.score > 0,
  );
  filtered.sort(
    (a, b) => b.score - a.score || a.title.localeCompare(b.title, "pt-BR"),
  );
  return filtered.slice(0, limit);
}
