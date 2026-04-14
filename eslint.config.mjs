// ESLint flat config para Nexus CRM.
// Integra next/core-web-vitals (padrão Next) + regra local `no-direct-consent-write`.
import { FlatCompat } from "@eslint/eslintrc";
import noDirectConsentWrite from "./eslint-rules/no-direct-consent-write.js";
import noConsoleInSrc from "./eslint-rules/no-console-in-src.js";
import noAdHocRoleCheck from "./eslint-rules/no-ad-hoc-role-check.js";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      "nexus-crm": {
        rules: {
          "no-direct-consent-write": noDirectConsentWrite,
          "no-console-in-src": noConsoleInSrc,
          "no-ad-hoc-role-check": noAdHocRoleCheck,
        },
      },
    },
    rules: {
      "nexus-crm/no-direct-consent-write": "error",
      // Promovido a error após migração completa de console.* para logger (src/ grep=0).
      "nexus-crm/no-console-in-src": "error",
      // warn em 1c.3; escalar para error em Fase 12 quando actions migradas
      "nexus-crm/no-ad-hoc-role-check": "warn",
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
