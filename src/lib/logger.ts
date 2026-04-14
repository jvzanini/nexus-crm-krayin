import pino from "pino";

/**
 * Logger estruturado central do Nexus CRM.
 *
 * - Saída JSON (NDJSON) em produção; pretty em dev (via pino-pretty se instalado,
 *   caso contrário permanece JSON — não explode se o módulo não existe).
 * - Redactors para chaves sensíveis: password, token, authorization, cookie.
 * - Base tags: service="nexus-crm", env=NODE_ENV.
 *
 * Uso:
 *   import { logger, childLogger } from "@/lib/logger";
 *   logger.info({ userId }, "auth.login.ok");
 *   const log = childLogger({ requestId }); log.warn({ code }, "ratelimit.near");
 */

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  redact: {
    paths: [
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "token",
      "*.token",
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
      "DATABASE_URL",
      "REDIS_URL",
    ],
    censor: "[REDACTED]",
  },
  base: {
    service: "nexus-crm",
    env: process.env.NODE_ENV ?? "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(
  bindings: Record<string, unknown>,
): ReturnType<typeof logger.child> {
  return logger.child(bindings);
}

/**
 * Mascara e-mail para logs: `joao@example.com` → `j***@example.com`.
 * Retorna null quando entrada inválida.
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const at = email.indexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain) return null;
  const visible = local[0] ?? "";
  return `${visible}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
}
