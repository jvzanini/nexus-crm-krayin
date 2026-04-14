import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateApiKey, verifyApiKey } from "../api-keys";

describe("generateApiKey (wrapper @nexusai360/api-keys)", () => {
  it("retorna shape correta {rawKey, keyPrefix, keyHash}", () => {
    const k = generateApiKey();
    expect(k).toHaveProperty("rawKey");
    expect(k).toHaveProperty("keyPrefix");
    expect(k).toHaveProperty("keyHash");
  });

  it("rawKey começa com prefixo nxk_", () => {
    const { rawKey } = generateApiKey();
    expect(rawKey.startsWith("nxk_")).toBe(true);
  });

  it("keyPrefix tem exatamente 12 caracteres", () => {
    const { keyPrefix } = generateApiKey();
    expect(keyPrefix).toHaveLength(12);
    expect(keyPrefix.startsWith("nxk_")).toBe(true);
  });

  it("keyHash é sha256 hex (64 chars) do rawKey", () => {
    const { rawKey, keyHash } = generateApiKey();
    const expected = createHash("sha256").update(rawKey).digest("hex");
    expect(keyHash).toBe(expected);
    expect(keyHash).toHaveLength(64);
  });

  it("gera chaves diferentes a cada chamada", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.rawKey).not.toBe(b.rawKey);
  });
});

describe("verifyApiKey (wrapper timing-safe)", () => {
  it("retorna true para hash correto", () => {
    const { rawKey, keyHash } = generateApiKey();
    expect(verifyApiKey(rawKey, keyHash)).toBe(true);
  });

  it("retorna false para hash incorreto", () => {
    const { rawKey } = generateApiKey();
    expect(verifyApiKey(rawKey, "0".repeat(64))).toBe(false);
  });

  it("retorna false para hash de tamanho diferente (timing-safe)", () => {
    const { rawKey } = generateApiKey();
    expect(verifyApiKey(rawKey, "abc")).toBe(false);
  });

  it("compat com hash legacy (formato nxk_<64hex>)", () => {
    // Simula uma key antiga gerada com randomBytes(32).toString("hex")
    const legacyRaw = "nxk_" + "a".repeat(64);
    const legacyHash = createHash("sha256").update(legacyRaw).digest("hex");
    expect(verifyApiKey(legacyRaw, legacyHash)).toBe(true);
  });
});
