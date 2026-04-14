"use strict";

const { RuleTester } = require("eslint");
const rule = require("./no-console-in-src");

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

tester.run("no-console-in-src", rule, {
  valid: [
    // Fora de src
    { filename: "/repo/scripts/tool.ts", code: "console.log('hi');" },
    { filename: "/repo/prisma/seed.ts", code: "console.log('hi');" },
    { filename: "/repo/eslint-rules/x.js", code: "console.log('hi');" },
    // Test files em src
    { filename: "/repo/src/lib/foo.test.ts", code: "console.log('hi');" },
    // Generated
    { filename: "/repo/src/generated/prisma/index.ts", code: "console.log('hi');" },
  ],
  invalid: [
    {
      filename: "/repo/src/lib/foo.ts",
      code: "console.log('x');",
      errors: [{ messageId: "useLogger" }],
    },
    {
      filename: "/repo/src/app/page.tsx",
      code: "console.error(err);",
      errors: [{ messageId: "useLogger" }],
    },
  ],
});

console.log("no-console-in-src: tests passed");
