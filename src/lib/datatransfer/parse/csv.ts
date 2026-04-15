import Papa from "papaparse";
import { Readable } from "stream";

export interface ParseCsvOptions {
  onRow?: (row: Record<string, string>, index: number) => void | Promise<void>;
  maxRows?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export interface ParseCsvResult {
  rowCount: number;
  columns: string[];
  sample: Record<string, string>[];
}

/**
 * Streaming CSV parser via papaparse.
 * Limita número de rows (`maxRows`, default 50k), walltime (`timeoutMs`,
 * default 60s) e respeita `AbortSignal` externo.
 */
async function streamToString(r: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of r) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks).toString("utf-8");
}

export async function parseCsv(
  input: Readable | string,
  opts: ParseCsvOptions = {},
): Promise<ParseCsvResult> {
  const maxRows = opts.maxRows ?? 50_000;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const sample: Record<string, string>[] = [];
  let columns: string[] = [];
  let rowCount = 0;

  const csvString = typeof input === "string" ? input : await streamToString(input);

  return new Promise<ParseCsvResult>((resolve, reject) => {
    let settled = false;
    const doResolve = (v: ParseCsvResult) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const doReject = (e: unknown) => {
      if (!settled) {
        settled = true;
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    const timer = setTimeout(() => {
      doReject(new Error("TIMEOUT: CSV parse walltime exceeded"));
    }, timeoutMs);

    const abortHandler = () => {
      clearTimeout(timer);
      doReject(new Error("ABORTED: parseCsv cancelled"));
    };
    if (opts.abortSignal) {
      if (opts.abortSignal.aborted) {
        clearTimeout(timer);
        return doReject(new Error("ABORTED: signal already aborted"));
      }
      opts.abortSignal.addEventListener("abort", abortHandler, { once: true });
    }

    Papa.parse<Record<string, string>>(csvString, {
      header: true,
      skipEmptyLines: true,
      step: (result, parser) => {
        if (opts.abortSignal?.aborted) {
          parser.abort();
          return;
        }
        if (columns.length === 0 && result.meta.fields) {
          columns = [...result.meta.fields];
        }
        rowCount += 1;
        if (rowCount > maxRows) {
          clearTimeout(timer);
          doReject(new Error(`MAX_ROWS: rows exceeded (${maxRows})`));
          parser.abort();
          return;
        }
        if (sample.length < 5) sample.push(result.data);
        if (opts.onRow) {
          try {
            const maybe = opts.onRow(result.data, rowCount - 1);
            if (maybe && typeof (maybe as Promise<unknown>).then === "function") {
              parser.pause();
              (maybe as Promise<unknown>)
                .then(() => parser.resume())
                .catch((err) => {
                  parser.abort();
                  clearTimeout(timer);
                  doReject(err);
                });
            }
          } catch (err) {
            parser.abort();
            clearTimeout(timer);
            doReject(err);
          }
        }
      },
      complete: () => {
        clearTimeout(timer);
        opts.abortSignal?.removeEventListener("abort", abortHandler);
        doResolve({ rowCount, columns, sample });
      },
      error: (err: Error) => {
        clearTimeout(timer);
        opts.abortSignal?.removeEventListener("abort", abortHandler);
        doReject(err);
      },
    });
  });
}
