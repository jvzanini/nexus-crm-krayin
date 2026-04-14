import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@nexusai360/types"],
  serverExternalPackages: ["bcryptjs"],
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
