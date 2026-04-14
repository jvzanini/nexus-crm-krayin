/**
 * ESLint rule: no-direct-consent-write
 *
 * Proíbe gravação direta nas colunas `consentMarketing`, `consentMarketingAt`,
 * `consentMarketingIpMask`, `consentTracking`, `consentTrackingAt`,
 * `consentTrackingIpMask` via `prisma.(lead|contact).(create|update|upsert|...)`
 * fora de `src/lib/consent/**` e `src/lib/actions/**`.
 *
 * Motivação: toda mudança de consent deve passar por `recordConsent` para que a
 * trilha em `consent_logs` seja gravada atomicamente junto com os denormalizados.
 */
"use strict";

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Proíbe escrita direta em campos de consent LGPD fora da camada autorizada (src/lib/consent/** ou src/lib/actions/**).",
    },
    schema: [],
    messages: {
      direct:
        "Escrita direta em campo de consent LGPD. Use `recordConsent(tx, …)` da lib `src/lib/consent` dentro de `src/lib/actions/{leads,contacts}.ts`.",
    },
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    const normalized = filename.replace(/\\/g, "/");
    const allowed =
      normalized.includes("/src/lib/consent/") ||
      normalized.includes("/src/lib/actions/");
    if (allowed) return {};

    const CONSENT_FIELDS = new Set([
      "consentMarketing",
      "consentMarketingAt",
      "consentMarketingIpMask",
      "consentTracking",
      "consentTrackingAt",
      "consentTrackingIpMask",
    ]);

    const MUTATING_METHODS = new Set([
      "create",
      "createMany",
      "update",
      "updateMany",
      "upsert",
    ]);

    /**
     * Retorna true se o ObjectExpression contiver uma property com um dos nomes
     * proibidos (directo ou via spread shallow não é inspecionado).
     */
    function objectHasConsentField(obj) {
      if (!obj || obj.type !== "ObjectExpression") return false;
      for (const prop of obj.properties) {
        if (prop.type !== "Property") continue;
        const key = prop.key;
        const name =
          key.type === "Identifier"
            ? key.name
            : key.type === "Literal"
              ? String(key.value)
              : null;
        if (name && CONSENT_FIELDS.has(name)) return true;
      }
      return false;
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        const methodNode = callee.property;
        if (!methodNode || methodNode.type !== "Identifier") return;
        if (!MUTATING_METHODS.has(methodNode.name)) return;

        // Esperamos callee como prisma.(lead|contact|tx.lead|tx.contact).method
        const target = callee.object;
        if (!target || target.type !== "MemberExpression") return;
        const model = target.property;
        if (!model || model.type !== "Identifier") return;
        if (model.name !== "lead" && model.name !== "contact") return;

        const arg = node.arguments[0];
        if (!arg || arg.type !== "ObjectExpression") return;

        // Acha `data: { … }` ou `create: { … }` (upsert)
        const dataProp = arg.properties.find(
          (p) =>
            p.type === "Property" &&
            p.key &&
            ((p.key.type === "Identifier" &&
              (p.key.name === "data" ||
                p.key.name === "create" ||
                p.key.name === "update")) ||
              (p.key.type === "Literal" &&
                (p.key.value === "data" ||
                  p.key.value === "create" ||
                  p.key.value === "update"))),
        );
        if (!dataProp) return;

        if (objectHasConsentField(dataProp.value)) {
          context.report({ node: dataProp, messageId: "direct" });
        }
      },
    };
  },
};
