import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "./aes-gcm";

describe("aes-gcm", () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.ENCRYPTION_MASTER_KEY;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ENCRYPTION_MASTER_KEY;
    } else {
      process.env.ENCRYPTION_MASTER_KEY = original;
    }
  });

  it("round-trip ASCII", () => {
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

  it("tamper authTag rejeita (flip byte em offset 12–27)", () => {
    process.env.ENCRYPTION_MASTER_KEY = "a".repeat(32);
    const enc = encrypt("secret");
    const buf = Buffer.from(enc, "base64");
    buf[12] ^= 0xff;
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });

  it("ENCRYPTION_MASTER_KEY ausente → encrypt lança", () => {
    delete process.env.ENCRYPTION_MASTER_KEY;
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_MASTER_KEY/);
  });

  it("key com < 32 chars → encrypt lança", () => {
    process.env.ENCRYPTION_MASTER_KEY = "short";
    expect(() => encrypt("x")).toThrow(/32 chars/);
  });
});
