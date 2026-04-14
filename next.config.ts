import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@nexusai360/design-system",
    "@nexusai360/users-ui",
    "@nexusai360/companies-ui",
    "@nexusai360/types",
  ],
  serverExternalPackages: [
    "bcryptjs",
    "@opentelemetry/sdk-node",
    "@opentelemetry/instrumentation-http",
    "@opentelemetry/instrumentation-pg",
  ],
};

// Sentry wrapper desativado temporariamente — suspeito de causar HTTP 500 em SSR
// sem SENTRY_DSN configurado. Re-ativar em Fase 12 quando DSN for provisionado
// com teste end-to-end. Atual: Sentry config carrega condicionalmente via
// instrumentation.ts já guardado por Boolean(dsn).
export default withNextIntl(nextConfig);
