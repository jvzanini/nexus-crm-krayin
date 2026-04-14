// ESLint flat config para Nexus CRM.
// Integra next/core-web-vitals (padrão Next) + regra local `no-direct-consent-write`.
import { FlatCompat } from "@eslint/eslintrc";
import noDirectConsentWrite from "./eslint-rules/no-direct-consent-write.js";
import noConsoleInSrc from "./eslint-rules/no-console-in-src.js";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      "nexus-crm": {
        rules: {
          "no-direct-consent-write": noDirectConsentWrite,
          "no-console-in-src": noConsoleInSrc,
        },
      },
    },
    rules: {
      "nexus-crm/no-direct-consent-write": "error",
      // warn-first em Fase 1c.0; migrar para "error" após grep de console.* = 0
      "nexus-crm/no-console-in-src": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/generated/**",
      "prisma/migrations/**",
      "tests/e2e/**/*-snapshots/**",
    ],
  },
];
