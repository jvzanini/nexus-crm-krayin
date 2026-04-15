import { describe, it, expect } from "vitest";
import { Readable } from "stream";
import { parseCsv } from "../csv";

function stream(content: string): Readable {
  return Readable.from([Buffer.from(content)]);
}

describe("parseCsv", () => {
  it("parse CSV simples e emite rows + complete", async () => {
    const rows: Record<string, string>[] = [];
    const r = await parseCsv(stream("a,b\n1,2\n3,4\n"), {
      onRow: (row) => {
        rows.push(row);
      },
    });
    expect(r.columns).toEqual(["a", "b"]);
    expect(r.rowCount).toBe(2);
    expect(rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("aborta quando rows > maxRows", async () => {
    const csv = "a\n" + Array.from({ length: 100 }, (_, i) => i).join("\n") + "\n";
    await expect(
      parseCsv(stream(csv), { maxRows: 10, onRow: () => {} }),
    ).rejects.toThrow(/MAX_ROWS|rows exceeded/i);
  });

  it("aborta quando abortSignal é acionado", async () => {
    const ctrl = new AbortController();
    const csv = "a\n" + Array.from({ length: 1000 }, (_, i) => i).join("\n") + "\n";
    setTimeout(() => ctrl.abort(), 5);
    await expect(
      parseCsv(stream(csv), {
        abortSignal: ctrl.signal,
        onRow: async () => {
          await new Promise((r) => setTimeout(r, 2));
        },
      }),
    ).rejects.toThrow(/ABORTED|abort/i);
  });
});
