import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // @nexusai360/* packages usam peerDependencies React 19 — resolução padrão do Next.
  // transpilePackages quebra (createContext undefined); serverExternalPackages quebra
  // (useContext null, dual React). Deixar Next decidir.
  transpilePackages: ["@nexusai360/types"],
  serverExternalPackages: ["bcryptjs"],
  webpack: (config) => {
    // Garante React único resolvendo app -> node_modules/react sempre.
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      react: require.resolve("react"),
      "react-dom": require.resolve("react-dom"),
      "react/jsx-runtime": require.resolve("react/jsx-runtime"),
      "react/jsx-dev-runtime": require.resolve("react/jsx-dev-runtime"),
    };
    return config;
  },
};

// Sentry wrapper desativado temporariamente — suspeito de causar HTTP 500 em SSR
// sem SENTRY_DSN configurado. Re-ativar em Fase 12 quando DSN for provisionado
// com teste end-to-end. Atual: Sentry config carrega condicionalmente via
// instrumentation.ts já guardado por Boolean(dsn).
export default withNextIntl(nextConfig);
