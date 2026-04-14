import { createHmac, timingSafeEqual } from "node:crypto";

export interface UnsubscribePayload {
  contactId: string;
  campaignId: string;
}

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  if (!s) throw new Error("UNSUBSCRIBE_TOKEN_SECRET is required");
  if (s.length < 32) throw new Error("UNSUBSCRIBE_TOKEN_SECRET must be >= 32 chars");
  return s;
}

function toB64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(data: string): string {
  return toB64Url(createHmac("sha256", secret()).update(data).digest());
}

export function signUnsubscribeToken(
  payload: UnsubscribePayload,
  issuedAtMs: number = Date.now(),
): string {
  const body = `${payload.contactId}.${payload.campaignId}.${issuedAtMs}`;
  const sig = sign(body);
  return `${toB64Url(Buffer.from(body))}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: UnsubscribePayload }
  | { ok: false; reason: "MALFORMED" | "INVALID_SIGNATURE" | "EXPIRED" };

export function verifyUnsubscribeToken(token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "MALFORMED" };

  const [bodyB64, sig] = parts;
  let body: string;
  try {
    body = Buffer.from(bodyB64, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }

  const expectedSig = sign(body);
  const provided = Buffer.from(sig, "base64url");
  const expected = Buffer.from(expectedSig, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }

  const bodyParts = body.split(".");
  if (bodyParts.length !== 3) return { ok: false, reason: "MALFORMED" };
  const [contactId, campaignId, issuedAtStr] = bodyParts;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return { ok: false, reason: "MALFORMED" };

  if (Date.now() - issuedAt > MAX_AGE_MS) {
    return { ok: false, reason: "EXPIRED" };
  }

  return { ok: true, payload: { contactId, campaignId } };
}
