import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SCRYPT_SALT = "nexus-crm-v1";

function deriveKey(): Buffer {
  const master = process.env.ENCRYPTION_MASTER_KEY;
  if (!master) throw new Error("ENCRYPTION_MASTER_KEY is required");
  if (master.length < 32) throw new Error("ENCRYPTION_MASTER_KEY must be >= 32 chars");
  return scryptSync(master, SCRYPT_SALT, 32);
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
