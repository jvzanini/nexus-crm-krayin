import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

// Content Security Policy — Fase 12.4. unsafe-inline/eval ainda permitidos
// porque Next 16 injeta inline chunks; aperto via nonce fica para follow-up.
const CSP_VALUE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Content-Security-Policy", value: CSP_VALUE },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  // Vendor packages @nexusai360/* DEVEM estar em transpilePackages + turbopack
  // resolveAlias abaixo garante instância única de react/react-dom entre app e vendor.
  // Sem transpile, standalone copia vendor para node_modules e o require em runtime
  // cria segunda instância de React → useState null em SSR (dual React 2026-04-14).
  transpilePackages: [
    "@nexusai360/types",
    "@nexusai360/design-system",
    "@nexusai360/users-ui",
    "@nexusai360/companies-ui",
    "@nexusai360/profile-ui",
    "@nexusai360/settings-ui",
    "@nexusai360/api-keys",
    "@nexusai360/core",
    "@nexusai360/multi-tenant",
    "@nexusai360/audit-log",
    "@nexusai360/patterns",
  ],
  serverExternalPackages: [
    "bcryptjs",
    "@opentelemetry/sdk-node",
    "@opentelemetry/instrumentation-http",
    "@opentelemetry/instrumentation-pg",
  ],
  // Next 16 usa turbopack por padrão em `next build`. webpack config é IGNORADO.
  // Alias força instância única de react/react-dom (fix dual-React — log prod:
  // "Cannot read properties of null (reading 'useContext')").
  turbopack: {
    resolveAlias: {
      react: "./node_modules/react",
      "react-dom": "./node_modules/react-dom",
      "react/jsx-runtime": "./node_modules/react/jsx-runtime.js",
      "react/jsx-dev-runtime": "./node_modules/react/jsx-dev-runtime.js",
    },
  },
};

// Sentry wrapper desativado temporariamente — suspeito de causar HTTP 500 em SSR
// sem SENTRY_DSN configurado. Re-ativar em Fase 12 quando DSN for provisionado
// com teste end-to-end. Atual: Sentry config carrega condicionalmente via
// instrumentation.ts já guardado por Boolean(dsn).
export default withNextIntl(nextConfig);
