// Helpers para API Keys — wrapper @nexusai360/api-keys
import {
  generateApiKey as generateApiKeyFromPkg,
  hashApiKey,
  timingSafeCompareHex,
} from "@nexusai360/api-keys";

export interface GeneratedApiKey {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
}

/**
 * Gera nova API key. Formato: nxk_<32 chars nanoid>.
 * keyPrefix = primeiros 12 chars (`nxk_<8 chars>`).
 * rawKey é mostrado UMA vez ao usuário e nunca armazenado.
 */
export function generateApiKey(): GeneratedApiKey {
  return generateApiKeyFromPkg("nxk");
}

/**
 * Verifica se rawKey corresponde a um hash armazenado.
 * Usa comparação timing-safe (fix vs implementação anterior que usava `===`).
 * Compat: hashes de keys antigas (formato nxk_<64hex>) continuam validando.
 */
export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  return timingSafeCompareHex(hashApiKey(rawKey), storedHash);
}
