import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";

describe("unsubscribe token", () => {
  const ORIGINAL = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  beforeEach(() => {
    process.env.UNSUBSCRIBE_TOKEN_SECRET = "a".repeat(32);
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    else process.env.UNSUBSCRIBE_TOKEN_SECRET = ORIGINAL;
  });

  it("round-trip válido", () => {
    const t = signUnsubscribeToken({ contactId: "c1", campaignId: "camp1" });
    expect(verifyUnsubscribeToken(t)).toEqual({
      ok: true,
      payload: { contactId: "c1", campaignId: "camp1" },
    });
  });

  it("tamper rejeita", () => {
    const t = signUnsubscribeToken({ contactId: "c1", campaignId: "camp1" });
    const tampered = t.slice(0, -4) + "xxxx";
    const result = verifyUnsubscribeToken(tampered);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("expirado rejeita (> 90 dias)", () => {
    const oldIssuedAt = Date.now() - 91 * 24 * 60 * 60 * 1000;
    const t = signUnsubscribeToken(
      { contactId: "c1", campaignId: "camp1" },
      oldIssuedAt,
    );
    const result = verifyUnsubscribeToken(t);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("EXPIRED");
  });

  it("sem SECRET lança", () => {
    delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    expect(() =>
      signUnsubscribeToken({ contactId: "c1", campaignId: "c1" }),
    ).toThrow(/UNSUBSCRIBE_TOKEN_SECRET/);
  });
});
