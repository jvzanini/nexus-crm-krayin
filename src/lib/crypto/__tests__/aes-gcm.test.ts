import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "./aes-gcm";

describe("aes-gcm", () => {
  let originalMaster: string | undefined;
  let originalKey: string | undefined;

  beforeEach(() => {
    originalMaster = process.env.ENCRYPTION_MASTER_KEY;
    originalKey = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_MASTER_KEY;
  });

  afterEach(() => {
    if (originalMaster === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
    else process.env.ENCRYPTION_MASTER_KEY = originalMaster;
    if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = originalKey;
  });

  it("round-trip ASCII (MASTER key path)", () => {
    process.env.ENCRYPTION_MASTER_KEY = "a".repeat(32);
    const enc = encrypt("hello world");
    expect(decrypt(enc)).toBe("hello world");
  });

  it("round-trip Unicode (emoji)", () => {
    process.env.ENCRYPTION_MASTER_KEY = "a".repeat(32);
    expect(decrypt(encrypt("olá 🌱"))).toBe("olá 🌱");
  });

  it("round-trip string longa (10kB)", () => {
    process.env.ENCRYPTION_MASTER_KEY = "a".repeat(32);
    const long = "x".repeat(10 * 1024);
    expect(decrypt(encrypt(long))).toBe(long);
  });

  it("tamper authTag rejeita", () => {
    process.env.ENCRYPTION_MASTER_KEY = "a".repeat(32);
    const enc = encrypt("secret");
    const buf = Buffer.from(enc, "base64");
    buf[12] ^= 0xff;
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });

  it("sem env → encrypt lança mensagem composta", () => {
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY.*ENCRYPTION_MASTER_KEY/);
  });

  it("ENCRYPTION_MASTER_KEY com < 32 chars → encrypt lança", () => {
    process.env.ENCRYPTION_MASTER_KEY = "short";
    expect(() => encrypt("x")).toThrow(/32 chars/);
  });

  it("ENCRYPTION_KEY hex válido (64 chars) é preferido sobre MASTER_KEY", () => {
    process.env.ENCRYPTION_KEY = "00".repeat(32); // 64 hex chars
    process.env.ENCRYPTION_MASTER_KEY = "z".repeat(64); // diferente → derivaria outra key
    const enc = encrypt("probe");

    // Remove ENCRYPTION_MASTER_KEY; decrypt só consegue com ENCRYPTION_KEY.
    delete process.env.ENCRYPTION_MASTER_KEY;
    expect(decrypt(enc)).toBe("probe");
  });

  it("ENCRYPTION_KEY formato inválido → lança", () => {
    process.env.ENCRYPTION_KEY = "not-hex-$$$";
    expect(() => encrypt("x")).toThrow(/64 hex chars/);
  });

  it("ENCRYPTION_KEY com comprimento errado → lança", () => {
    process.env.ENCRYPTION_KEY = "ab";
    expect(() => encrypt("x")).toThrow(/64 hex chars/);
  });
});
