import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseFile } from "../index";

describe("parseFile orchestrator", () => {
  it("dispatcha para CSV quando mime é text/csv", async () => {
    const buf = Buffer.from("a,b\n1,2\n");
    const r = await parseFile(buf, "ok.csv");
    expect(r.rowCount).toBe(1);
    expect(r.columns).toEqual(["a", "b"]);
  });

  it("rejeita quando size > 20MB", async () => {
    const big = Buffer.alloc(21 * 1024 * 1024);
    await expect(parseFile(big, "big.csv")).rejects.toThrow(
      /FILE_TOO_LARGE|size/i,
    );
  });

  it("rejeita quando mime real não bate com extensão", async () => {
    // "MZ" = Windows executable magic bytes.
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]);
    await expect(parseFile(exe, "fake.csv")).rejects.toThrow(
      /MIME_MISMATCH|mime/i,
    );
  });

  it("dispatcha XLSX para parseXlsx", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["col1", "col2"]);
    ws.addRow(["v1", "v2"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const r = await parseFile(buf, "data.xlsx");
    expect(r.columns).toEqual(["col1", "col2"]);
    expect(r.rowCount).toBe(1);
  });
});
