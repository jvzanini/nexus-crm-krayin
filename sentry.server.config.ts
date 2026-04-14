import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  tracesSampleRate: 0, // Fase 1c: capture only; trace sampling avaliado em Fase 12
  profilesSampleRate: 0,
  beforeSend(event) {
    // Scrub chaves sensíveis em contexts/extras antes de enviar
    const keysToScrub = [
      "DATABASE_URL",
      "REDIS_URL",
      "SESSION_SECRET",
      "NEXTAUTH_SECRET",
      "password",
      "passwordHash",
      "token",
      "accessToken",
      "refreshToken",
    ];
    function scrub(obj: unknown): void {
      if (!obj || typeof obj !== "object") return;
      for (const k of Object.keys(obj as Record<string, unknown>)) {
        if (keysToScrub.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
          (obj as Record<string, unknown>)[k] = "[REDACTED]";
        } else {
          scrub((obj as Record<string, unknown>)[k]);
        }
      }
    }
    scrub(event.extra);
    scrub(event.contexts);
    return event;
  },
});
