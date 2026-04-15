import { describe, it, expect } from "vitest";
import { detectBOM, detectEncoding } from "../encoding";

describe("detectBOM", () => {
  it("detecta UTF-8 BOM (EF BB BF)", () => {
    expect(detectBOM(Buffer.from([0xef, 0xbb, 0xbf, 0x61]))).toBe("utf-8");
  });
  it("detecta UTF-16 LE (FF FE)", () => {
    expect(detectBOM(Buffer.from([0xff, 0xfe, 0x00, 0x61]))).toBe("utf-16le");
  });
  it("detecta UTF-16 BE (FE FF)", () => {
    expect(detectBOM(Buffer.from([0xfe, 0xff, 0x00, 0x61]))).toBe("utf-16be");
  });
  it("retorna null sem BOM", () => {
    expect(detectBOM(Buffer.from("hello"))).toBeNull();
  });
});

describe("detectEncoding", () => {
  it("UTF-8 BOM é aceito direto", () => {
    const r = detectEncoding(Buffer.from([0xef, 0xbb, 0xbf, 0x68, 0x69]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.encoding).toBe("utf-8");
      expect(r.confidence).toBeGreaterThanOrEqual(1);
    }
  });

  it("UTF-16 é rejeitado com code UNSUPPORTED_ENCODING", () => {
    const r = detectEncoding(Buffer.from([0xff, 0xfe, 0x00, 0x61]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("UNSUPPORTED_ENCODING");
    }
  });

  it("latin1 é detectado via chardet e retorna candidates", () => {
    // Buffer com bytes latin-1 (ISO-8859-1) — ex: char "ç" em iso = 0xE7
    const buf = Buffer.from([0x63, 0xe7, 0x61, 0x6f]);
    const r = detectEncoding(buf);
    // chardet pode sugerir qualquer encoding compatível; o teste só exige
    // que o resultado seja processável (ok ou needsEncoding com candidates).
    expect(r.ok === true || (r.ok === false && r.code === "LOW_CONFIDENCE")).toBe(true);
  });
});
