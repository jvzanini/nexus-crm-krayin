import { describe, it, expect, beforeEach } from "vitest";
import { encryptMailboxTokens, decryptMailboxTokens } from "../tokens";

beforeEach(() => {
  process.env.ENCRYPTION_MASTER_KEY = "a".repeat(32);
});

describe("encryptMailboxTokens / decryptMailboxTokens", () => {
  it("round-trip accessToken", () => {
    const plain = { accessToken: "access-token-abc123" };
    const enc = encryptMailboxTokens(plain);
    const dec = decryptMailboxTokens(enc);
    expect(dec.accessToken).toBe(plain.accessToken);
  });

  it("round-trip refreshToken", () => {
    const plain = { refreshToken: "refresh-token-xyz789" };
    const enc = encryptMailboxTokens(plain);
    const dec = decryptMailboxTokens(enc);
    expect(dec.refreshToken).toBe(plain.refreshToken);
  });

  it("round-trip authPassword", () => {
    const plain = { authPassword: "s3cr3t!p@ssw0rd" };
    const enc = encryptMailboxTokens(plain);
    const dec = decryptMailboxTokens(enc);
    expect(dec.authPassword).toBe(plain.authPassword);
  });

  it("null in → null out para todos os campos", () => {
    const enc = encryptMailboxTokens({
      accessToken: null,
      refreshToken: null,
      authPassword: null,
    });
    expect(enc.accessTokenEnc).toBeNull();
    expect(enc.refreshTokenEnc).toBeNull();
    expect(enc.authPasswordEnc).toBeNull();

    const dec = decryptMailboxTokens(enc);
    expect(dec.accessToken).toBeNull();
    expect(dec.refreshToken).toBeNull();
    expect(dec.authPassword).toBeNull();
  });

  it("partial — só accessToken definido", () => {
    const plain = { accessToken: "only-access" };
    const enc = encryptMailboxTokens(plain);
    expect(enc.accessTokenEnc).not.toBeNull();
    expect(enc.refreshTokenEnc).toBeNull();
    expect(enc.authPasswordEnc).toBeNull();

    const dec = decryptMailboxTokens(enc);
    expect(dec.accessToken).toBe("only-access");
    expect(dec.refreshToken).toBeNull();
    expect(dec.authPassword).toBeNull();
  });

  it("preserva unicode", () => {
    const plain = { authPassword: "p@$$w0rd — ñoño — 日本語テスト" };
    const enc = encryptMailboxTokens(plain);
    const dec = decryptMailboxTokens(enc);
    expect(dec.authPassword).toBe(plain.authPassword);
  });
});
