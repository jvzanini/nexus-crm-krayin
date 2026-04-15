"use client";

import { normalize } from "@/lib/search/normalize";

interface Props {
  text: string;
  query: string;
}

export function HighlightMatch({ text, query }: Props) {
  if (!text) return null;
  const trimmed = (query ?? "").trim();
  if (!trimmed || trimmed.length < 2) return <>{text}</>;

  const nText = normalize(text);
  const nQuery = normalize(trimmed);
  const idx = nText.indexOf(nQuery);
  if (idx === -1) return <>{text}</>;

  const end = idx + nQuery.length;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/15 text-foreground rounded-sm px-0.5 font-medium">
        {text.slice(idx, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}
