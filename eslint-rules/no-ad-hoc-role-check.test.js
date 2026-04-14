"use strict";
const { RuleTester } = require("eslint");
const rule = require("./no-ad-hoc-role-check");

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

tester.run("no-ad-hoc-role-check", rule, {
  valid: [
    // Dentro de src/lib/rbac: permitido (é a camada que checa)
    {
      filename: "/repo/src/lib/rbac/index.ts",
      code: "if (user.platformRole === 'admin') {}",
    },
    // src/auth: permitido
    {
      filename: "/repo/src/auth.ts",
      code: "if (user.platformRole === 'admin') {}",
    },
    // Teste: permitido
    {
      filename: "/repo/src/lib/x.test.ts",
      code: "expect(user.platformRole === 'admin').toBe(true);",
    },
    // Comparação com valor não-role: sem match
    {
      filename: "/repo/src/app/page.tsx",
      code: "if (user.status === 'active') {}",
    },
    // role mas valor fora do set: sem match (evita falso-positivo)
    {
      filename: "/repo/src/app/page.tsx",
      code: "if (user.role === 'custom_x') {}",
    },
  ],
  invalid: [
    {
      filename: "/repo/src/lib/actions/leads.ts",
      code: "if (user.platformRole === 'admin') {}",
      errors: [{ messageId: "useRbac" }],
    },
    {
      filename: "/repo/src/some/handler.ts",
      code: "if ('seller' === user.role) {}",
      errors: [{ messageId: "useRbac" }],
    },
    {
      filename: "/repo/src/app/page.tsx",
      code: "const guard = session.user.platformRole !== 'viewer';",
      errors: [{ messageId: "useRbac" }],
    },
  ],
});

console.log("no-ad-hoc-role-check: tests passed");
