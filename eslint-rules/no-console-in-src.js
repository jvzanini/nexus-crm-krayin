/**
 * ESLint rule: no-console-in-src
 *
 * Proíbe `console.log/error/warn/info/debug` em `src/**` (exceto `src/generated/**`).
 * Rationale: logs estruturados devem usar `@/lib/logger` (pino) para redação de PII,
 * correlação via requestId, e shipping para o pipeline de observability.
 *
 * Permite `console` em arquivos de teste (`*.test.*`) e em `scripts/**` /
 * `eslint-rules/**` / `prisma/scripts/**` (ferramentas CLI).
 */
"use strict";

const ALLOWED_DIRS = [
  "/src/generated/",
  "/scripts/",
  "/eslint-rules/",
  "/prisma/",
  "/tests/",
  "/test/",
];

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Proíbe `console.*` em src/** (use @/lib/logger em seu lugar).",
    },
    schema: [],
    messages: {
      useLogger:
        "Use `logger` de `@/lib/logger` em vez de `console.{{method}}` (PII redaction + requestId correlation).",
    },
  },

  create(context) {
    const filename = (context.filename || context.getFilename() || "").replace(/\\/g, "/");

    // Somente aplica em src/**
    if (!filename.includes("/src/")) return {};
    if (ALLOWED_DIRS.some((d) => filename.includes(d))) return {};
    if (/\.(test|spec)\.[tj]sx?$/.test(filename)) return {};

    return {
      MemberExpression(node) {
        if (node.object.type !== "Identifier") return;
        if (node.object.name !== "console") return;
        if (!node.property || node.property.type !== "Identifier") return;
        const method = node.property.name;
        if (!["log", "error", "warn", "info", "debug", "trace"].includes(method)) return;

        context.report({
          node,
          messageId: "useLogger",
          data: { method },
        });
      },
    };
  },
};
