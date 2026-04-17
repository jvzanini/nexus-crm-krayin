import { describe, it, expect } from "vitest";
import {
  isAllowedMime,
  enforceSize,
  enforceMime,
  FileTooLargeError,
  DisallowedMimeError,
} from "../allowlist";

describe("isAllowedMime", () => {
  it("retorna true para application/pdf", () => {
    expect(isAllowedMime("application/pdf")).toBe(true);
  });

  it("retorna false para image/bmp", () => {
    expect(isAllowedMime("image/bmp")).toBe(false);
  });

  it("retorna false para string vazia", () => {
    expect(isAllowedMime("")).toBe(false);
  });

  it("retorna true para image/png", () => {
    expect(isAllowedMime("image/png")).toBe(true);
  });

  it("retorna true para text/csv", () => {
    expect(isAllowedMime("text/csv")).toBe(true);
  });

  it("retorna false para text/html", () => {
    expect(isAllowedMime("text/html")).toBe(false);
  });
});

describe("enforceSize", () => {
  it("não lança para 24MB (dentro do limite padrão 25MB)", () => {
    expect(() => enforceSize(24 * 1024 * 1024)).not.toThrow();
  });

  it("lança FileTooLargeError para 26MB (acima do limite padrão 25MB)", () => {
    expect(() => enforceSize(26 * 1024 * 1024)).toThrowError(FileTooLargeError);
  });

  it("lança com custom maxMb: 11MB quando limite é 10MB", () => {
    expect(() => enforceSize(11 * 1024 * 1024, 10)).toThrowError(FileTooLargeError);
  });

  it("não lança para exatamente o limite", () => {
    expect(() => enforceSize(25 * 1024 * 1024)).not.toThrow();
  });

  it("FileTooLargeError tem bytes e maxMb corretos", () => {
    const bytes = 26 * 1024 * 1024;
    try {
      enforceSize(bytes);
      expect.fail("Deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(FileTooLargeError);
      const e = err as FileTooLargeError;
      expect(e.bytes).toBe(bytes);
      expect(e.maxMb).toBe(25);
    }
  });
});

describe("enforceMime", () => {
  it("não lança para application/pdf", () => {
    expect(() => enforceMime("application/pdf")).not.toThrow();
  });

  it("lança DisallowedMimeError para text/html", () => {
    expect(() => enforceMime("text/html")).toThrowError(DisallowedMimeError);
  });

  it("DisallowedMimeError tem mime correto", () => {
    try {
      enforceMime("image/bmp");
      expect.fail("Deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(DisallowedMimeError);
      const e = err as DisallowedMimeError;
      expect(e.mime).toBe("image/bmp");
    }
  });
});
