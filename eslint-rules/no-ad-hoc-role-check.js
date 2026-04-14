/**
 * ESLint rule: no-ad-hoc-role-check
 *
 * Sinaliza comparações literal `user.platformRole === "<role>"` /
 * `user.role === "<role>"` / `session.user.<role>...` fora de `src/lib/rbac/**`
 * e `src/auth*`. Força adoção de `hasPermission`/`requirePermission`.
 *
 * Em 1c.3 roda como **warn**. Em Fase 12 promover para error.
 */
"use strict";

const ROLE_LITERALS = new Set([
  "super_admin",
  "admin",
  "manager",
  "seller",
  "viewer",
]);

const PROP_NAMES = new Set(["role", "platformRole", "companyRole"]);

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Proíbe check adhoc de role (use hasPermission/requirePermission em @/lib/rbac).",
    },
    schema: [],
    messages: {
      useRbac:
        "Comparação adhoc com role \"{{role}}\". Use `requirePermission(\"<module>:<action>\")` de `@/lib/rbac`.",
    },
  },

  create(context) {
    const filename = (context.filename || context.getFilename() || "").replace(/\\/g, "/");
    if (
      filename.includes("/src/lib/rbac/") ||
      filename.includes("/src/auth") ||
      /\.(test|spec)\.[tj]sx?$/.test(filename)
    ) {
      return {};
    }

    function endsWithRoleProp(node) {
      if (!node) return false;
      if (node.type !== "MemberExpression") return false;
      const prop = node.property;
      if (!prop) return false;
      if (prop.type === "Identifier") return PROP_NAMES.has(prop.name);
      if (prop.type === "Literal" && typeof prop.value === "string")
        return PROP_NAMES.has(prop.value);
      return false;
    }

    function literalRoleValue(node) {
      if (!node) return null;
      if (node.type === "Literal" && typeof node.value === "string") {
        return ROLE_LITERALS.has(node.value) ? node.value : null;
      }
      return null;
    }

    return {
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "!==") return;

        const leftProp = endsWithRoleProp(node.left);
        const rightProp = endsWithRoleProp(node.right);
        const leftLit = literalRoleValue(node.right);
        const rightLit = literalRoleValue(node.left);

        if (leftProp && leftLit) {
          context.report({ node, messageId: "useRbac", data: { role: leftLit } });
          return;
        }
        if (rightProp && rightLit) {
          context.report({ node, messageId: "useRbac", data: { role: rightLit } });
        }
      },
    };
  },
};
