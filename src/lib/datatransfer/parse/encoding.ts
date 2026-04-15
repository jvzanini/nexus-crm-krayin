import chardet from "chardet";

export type BomEncoding = "utf-8" | "utf-16le" | "utf-16be";

/** Retorna o encoding indicado pelo BOM, ou null se ausente. */
export function detectBOM(buf: Buffer): BomEncoding | null {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return "utf-8";
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return "utf-16le";
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return "utf-16be";
  return null;
}

export type EncodingResult =
  | { ok: true; encoding: string; confidence: number }
  | {
      ok: false;
      code: "UNSUPPORTED_ENCODING" | "LOW_CONFIDENCE";
      detail?: string;
      candidates?: { encoding: string; confidence: number }[];
    };

/**
 * Pipeline de detecção:
 * 1. BOM UTF-8 → accept.
 * 2. BOM UTF-16 → reject UNSUPPORTED_ENCODING.
 * 3. chardet.analyse → accept se confidence ≥ 70; senão LOW_CONFIDENCE + candidates.
 */
export function detectEncoding(
  buf: Buffer,
  opts: { minConfidence?: number } = {},
): EncodingResult {
  const bom = detectBOM(buf);
  if (bom === "utf-8") return { ok: true, encoding: "utf-8", confidence: 1 };
  if (bom === "utf-16le" || bom === "utf-16be") {
    return {
      ok: false,
      code: "UNSUPPORTED_ENCODING",
      detail: bom.toUpperCase(),
    };
  }

  const min = opts.minConfidence ?? 70;
  const sample = buf.slice(0, Math.min(buf.length, 64 * 1024));
  const analyse = chardet.analyse(sample);
  if (!analyse || analyse.length === 0) {
    return { ok: false, code: "LOW_CONFIDENCE", candidates: [] };
  }
  const top = analyse[0]!;
  if (top.confidence >= min) {
    return {
      ok: true,
      encoding: top.name.toLowerCase(),
      confidence: top.confidence / 100,
    };
  }
  return {
    ok: false,
    code: "LOW_CONFIDENCE",
    candidates: analyse.slice(0, 5).map((c) => ({
      encoding: c.name.toLowerCase(),
      confidence: c.confidence / 100,
    })),
  };
}
