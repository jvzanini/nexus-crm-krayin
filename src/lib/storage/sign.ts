import { createHmac, timingSafeEqual } from "crypto";

/**
 * HMAC signing para URLs servidas pelo route handler `/api/storage/signed`.
 *
 * Formato do querystring: `?key=<b64>&sig=<hex>&exp=<unix-seconds>`.
 * Assina `${keyB64}:${exp}` com HMAC-SHA-256 e `STORAGE_SIGN_SECRET`.
 */

function getSecret(): string {
  const secret = process.env.STORAGE_SIGN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "STORAGE_SIGN_SECRET ausente ou muito curto (min 16 chars).",
    );
  }
  return secret;
}

export function signKey(key: string, ttlSec: number): {
  keyB64: string;
  sig: string;
  exp: number;
} {
  const keyB64 = Buffer.from(key, "utf-8").toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = createHmac("sha256", getSecret())
    .update(`${keyB64}:${exp}`)
    .digest("hex");
  return { keyB64, sig, exp };
}

export interface VerifyResult {
  valid: boolean;
  reason?: "expired" | "bad-signature" | "malformed";
  key?: string;
}

export function verifySignedUrlParams(params: {
  key: string;
  sig: string;
  exp: string;
}): VerifyResult {
  const { key: keyB64, sig, exp } = params;
  if (!keyB64 || !sig || !exp) return { valid: false, reason: "malformed" };
  const expNum = Number(exp);
  if (!Number.isFinite(expNum)) return { valid: false, reason: "malformed" };
  if (Math.floor(Date.now() / 1000) > expNum) {
    return { valid: false, reason: "expired" };
  }
  const expectedSig = createHmac("sha256", getSecret())
    .update(`${keyB64}:${exp}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "bad-signature" };
  }
  try {
    const key = Buffer.from(keyB64, "base64url").toString("utf-8");
    return { valid: true, key };
  } catch {
    return { valid: false, reason: "malformed" };
  }
}

export function buildSignedPath(key: string, ttlSec: number): string {
  const { keyB64, sig, exp } = signKey(key, ttlSec);
  const qs = new URLSearchParams({ key: keyB64, sig, exp: String(exp) });
  return `/api/storage/signed?${qs.toString()}`;
}
