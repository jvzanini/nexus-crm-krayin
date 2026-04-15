import { fileTypeFromBuffer } from "file-type";
import iconv from "iconv-lite";
import { parseCsv, type ParseCsvOptions } from "./csv";
import { parseXlsx, type ParseXlsxOptions } from "./xlsx";
import { detectEncoding } from "./encoding";

export interface ParseFileOptions extends ParseCsvOptions, ParseXlsxOptions {
  maxSizeBytes?: number;
  encodingOverride?: string;
}

export interface ParseFileResult {
  rowCount: number;
  columns: string[];
  sample: Record<string, string>[];
  needsEncoding?: boolean;
  encodingCandidates?: { encoding: string; confidence: number }[];
}

const CSV_MIMES = new Set(["text/csv", "text/plain", "application/csv"]);
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function extOf(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename);
  return m ? m[1]!.toLowerCase() : "";
}

/**
 * Orquestrador:
 * 1. Guard tamanho (default 20MB).
 * 2. Detecta mime real via file-type (magic bytes). Fallback para ext-based (CSV não tem magic confiável).
 * 3. Rejeita ext↔mime mismatch.
 * 4. CSV: decode encoding + parseCsv. XLSX: parseXlsx.
 */
export async function parseFile(
  buf: Buffer,
  filename: string,
  opts: ParseFileOptions = {},
): Promise<ParseFileResult> {
  const maxSize = opts.maxSizeBytes ?? 20 * 1024 * 1024;
  if (buf.byteLength > maxSize) {
    throw new Error(
      `FILE_TOO_LARGE: ${buf.byteLength} bytes > ${maxSize} bytes`,
    );
  }

  const ext = extOf(filename);
  // file-type@19 exige Uint8Array/ArrayBuffer (não aceita Buffer com jsdom env).
  const uint = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const detected = await fileTypeFromBuffer(uint);

  if (ext === "xlsx") {
    if (!detected || detected.mime !== XLSX_MIME) {
      throw new Error(
        `MIME_MISMATCH: extensão xlsx com mime ${detected?.mime ?? "desconhecido"}`,
      );
    }
    return parseXlsx(buf, opts);
  }

  if (ext === "csv") {
    // CSV não tem magic bytes confiáveis — file-type retorna null para texto.
    // Se file-type detectou algo que NÃO seja texto genérico, reject.
    if (detected && !CSV_MIMES.has(detected.mime) && (detected.mime as string) !== "application/octet-stream") {
      throw new Error(
        `MIME_MISMATCH: extensão csv com mime real ${detected.mime}`,
      );
    }
    // Encoding pipeline.
    let csvString: string;
    if (opts.encodingOverride) {
      csvString = iconv.decode(buf, opts.encodingOverride);
    } else {
      const enc = detectEncoding(buf);
      if (!enc.ok && enc.code === "UNSUPPORTED_ENCODING") {
        throw new Error(`UNSUPPORTED_ENCODING: ${enc.detail}`);
      }
      if (!enc.ok) {
        // Fallback: se ASCII puro (sem bytes >127), assume UTF-8.
        const hasHighBytes = buf.some((b) => b > 127);
        if (!hasHighBytes) {
          csvString = buf.toString("utf-8");
        } else {
          return {
            rowCount: 0,
            columns: [],
            sample: [],
            needsEncoding: true,
            encodingCandidates: enc.candidates,
          };
        }
      } else {
        csvString = iconv.decode(buf, enc.encoding);
      }
    }
    const r = await parseCsv(csvString, opts);
    return {
      rowCount: r.rowCount,
      columns: r.columns,
      sample: r.sample,
    };
  }

  throw new Error(`UNSUPPORTED_EXTENSION: .${ext}`);
}
