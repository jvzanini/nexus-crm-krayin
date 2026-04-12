// Helpers para API Keys
import { createHash, randomBytes } from "crypto";

const PREFIX_LENGTH = 8;

/**
 * Gera um par (rawKey, keyPrefix, keyHash) para uma nova API key.
 * rawKey é mostrado UMA vez ao usuário e nunca armazenado.
 */
export function generateApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const rawKey = `nxk_${randomBytes(32).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, PREFIX_LENGTH + 4); // "nxk_" + 8 chars
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  return { rawKey, keyPrefix, keyHash };
}

/**
 * Verifica se uma rawKey corresponde ao hash armazenado.
 */
export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const hash = createHash("sha256").update(rawKey).digest("hex");
  return hash === storedHash;
}
