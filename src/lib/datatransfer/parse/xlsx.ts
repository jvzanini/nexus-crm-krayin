import ExcelJS from "exceljs";
import yauzl from "yauzl";
import { Readable } from "stream";

export interface ParseXlsxOptions {
  onRow?: (row: Record<string, string>, index: number) => void | Promise<void>;
  maxRows?: number;
  abortSignal?: AbortSignal;
}

export interface ParseXlsxResult {
  rowCount: number;
  columns: string[];
  sample: Record<string, string>[];
}

export type ZipBombCheck =
  | { ok: true }
  | { ok: false; code: "ZIP_BOMB"; ratio: number };

export function checkZipBombRatio(args: {
  uncompressed: number;
  compressed: number;
}): ZipBombCheck {
  const { uncompressed, compressed } = args;
  if (compressed <= 0) return { ok: true };
  const ratio = uncompressed / compressed;
  if (ratio > 100) return { ok: false, code: "ZIP_BOMB", ratio };
  return { ok: true };
}

/** Abre XLSX via yauzl e checa ratio uncompressed/compressed agregado. */
export function checkZipBomb(buf: Buffer): Promise<ZipBombCheck> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buf,
      { lazyEntries: true },
      (err: Error | null, zip) => {
        if (err || !zip) {
          return reject(err ?? new Error("zip parse failed"));
        }
        let totalUncompressed = 0;
        let totalCompressed = 0;
        zip.on("entry", (entry: any) => {
          totalUncompressed += Number(entry.uncompressedSize ?? 0);
          totalCompressed += Number(entry.compressedSize ?? 0);
          zip.readEntry();
        });
        zip.on("end", () => {
          resolve(
            checkZipBombRatio({
              uncompressed: totalUncompressed,
              compressed: totalCompressed,
            }),
          );
        });
        zip.on("error", reject);
        zip.readEntry();
      },
    );
  });
}

/**
 * Parse XLSX via ExcelJS streaming. Primeira row = headers; demais rows
 * emitidas via `onRow`. Antes de parsear, roda `checkZipBomb`.
 */
export async function parseXlsx(
  buf: Buffer,
  opts: ParseXlsxOptions = {},
): Promise<ParseXlsxResult> {
  const bombCheck = await checkZipBomb(buf);
  if (!bombCheck.ok) {
    throw new Error(
      `ZIP_BOMB: uncompressed/compressed ratio ${bombCheck.ratio.toFixed(1)} exceeds 100`,
    );
  }

  const maxRows = opts.maxRows ?? 50_000;
  const sample: Record<string, string>[] = [];
  let columns: string[] = [];
  let rowCount = 0;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("XLSX vazio — sem worksheet");

  let headerDone = false;
  for (const row of ws.getRows(1, ws.rowCount) ?? []) {
    if (opts.abortSignal?.aborted) {
      throw new Error("ABORTED: parseXlsx cancelled");
    }
    const values = Array.isArray(row.values)
      ? (row.values as unknown[]).slice(1).map((v) => (v == null ? "" : String(v)))
      : [];
    if (!headerDone) {
      columns = values.map((v) => v.trim());
      headerDone = true;
      continue;
    }
    if (values.length === 0 || values.every((v) => v === "")) continue;
    const record: Record<string, string> = {};
    for (let i = 0; i < columns.length; i++) {
      record[columns[i]!] = values[i] ?? "";
    }
    rowCount += 1;
    if (rowCount > maxRows) {
      throw new Error(`MAX_ROWS: rows exceeded (${maxRows})`);
    }
    if (sample.length < 5) sample.push(record);
    if (opts.onRow) await opts.onRow(record, rowCount - 1);
  }

  return { rowCount, columns, sample };
}
