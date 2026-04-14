// ESLint flat config para Nexus CRM.
// Integra next/core-web-vitals (padrão Next) + regra local `no-direct-consent-write`.
import { FlatCompat } from "@eslint/eslintrc";
import noDirectConsentWrite from "./eslint-rules/no-direct-consent-write.js";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      "nexus-crm": {
        rules: {
          "no-direct-consent-write": noDirectConsentWrite,
        },
      },
    },
    rules: {
      "nexus-crm/no-direct-consent-write": "error",
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
