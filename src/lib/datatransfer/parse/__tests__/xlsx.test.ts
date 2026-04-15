import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseXlsx, checkZipBombRatio } from "../xlsx";

async function buildXlsx(rows: (string | number)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

describe("parseXlsx", () => {
  it("parse XLSX básico retorna columns + rowCount + sample", async () => {
    const buf = await buildXlsx([
      ["name", "email"],
      ["Alice", "a@x.com"],
      ["Bob", "b@x.com"],
    ]);
    const rows: Record<string, string>[] = [];
    const r = await parseXlsx(buf, {
      onRow: (row) => {
        rows.push(row);
      },
    });
    expect(r.columns).toEqual(["name", "email"]);
    expect(r.rowCount).toBe(2);
    expect(rows[0]).toEqual({ name: "Alice", email: "a@x.com" });
  });
});

describe("checkZipBombRatio", () => {
  it("aceita ratio baixo (<100)", () => {
    // XLSX real tem ratio ~10-20.
    const res = checkZipBombRatio({ uncompressed: 100_000, compressed: 10_000 });
    expect(res.ok).toBe(true);
  });
  it("rejeita ratio >100 (zip bomb)", () => {
    const res = checkZipBombRatio({ uncompressed: 1_000_000, compressed: 5_000 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("ZIP_BOMB");
  });
});
