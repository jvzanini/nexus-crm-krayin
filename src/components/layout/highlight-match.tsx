"use client";

import { normalize } from "@/lib/search/normalize";

/**
 * Variante de normalize SEM trim — usada para comparação por fragmento
 * em offsets preservados. `normalize` original faz `.trim()` e induziria
 * falso-positivo em fragmentos iniciados por espaço (ex.: " Maria" → "maria").
 */
function normalizeFragment(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

interface Props {
  text: string;
  query: string;
}

/**
 * Encontra todas as ocorrências de `query` em `text` usando comparação
 * normalizada (NFD + strip diacríticos + lowercase), mas retornando offsets
 * no texto ORIGINAL. Resolve o bug de desalinhamento quando `text` está em
 * forma NFD (combining marks) — a normalização encurta a string e ofssets
 * do espaço normalizado não valem no original.
 *
 * Algoritmo O(n*k): para cada índice i, tenta estender a janela [i, j] até
 * que `normalize(text.slice(i, j)) === normalizedQuery`. Pula para depois
 * do match ao encontrar.
 */
function findMatches(text: string, normalizedQuery: string): Array<[number, number]> {
  if (!normalizedQuery) return [];
  const matches: Array<[number, number]> = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    let found = false;
    for (let j = i + 1; j <= n; j++) {
      const nSlice = normalizeFragment(text.slice(i, j));
      if (nSlice === normalizedQuery) {
        matches.push([i, j]);
        i = j;
        found = true;
        break;
      }
      // Se o slice normalizado já excedeu o tamanho da query E não bate,
      // extensões maiores também não vão bater (normalize é monotônico no
      // tamanho para strings contíguas).
      if (nSlice.length > normalizedQuery.length) break;
    }
    if (!found) i++;
  }
  return matches;
}

export function HighlightMatch({ text, query }: Props) {
  if (!text) return null;
  const trimmed = (query ?? "").trim();
  if (!trimmed || trimmed.length < 2) return <>{text}</>;

  const nQuery = normalize(trimmed);
  const matches = findMatches(text, nQuery);
  if (matches.length === 0) return <>{text}</>;

  const parts: Array<React.ReactNode> = [];
  let cursor = 0;
  matches.forEach(([start, end], idx) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={`m-${idx}`}
        className="bg-primary/15 text-foreground rounded-sm px-0.5 font-medium"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  return <>{parts}</>;
}
