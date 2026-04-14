"use strict";

const { RuleTester } = require("eslint");
const rule = require("./no-direct-consent-write");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

tester.run("no-direct-consent-write", rule, {
  valid: [
    {
      // Escrita em src/lib/actions é permitida (a lib recordConsent pode ser chamada dela)
      filename: "/repo/src/lib/actions/leads.ts",
      code: `
        prisma.lead.update({
          where: { id },
          data: { consentMarketing: true },
        });
      `,
    },
    {
      filename: "/repo/src/lib/consent/record.ts",
      code: `
        tx.contact.update({
          where: { id },
          data: { consentTracking: false, consentTrackingAt: new Date() },
        });
      `,
    },
    {
      filename: "/repo/src/some/page.tsx",
      code: `
        prisma.lead.update({
          where: { id },
          data: { name: "João" },
        });
      `,
    },
    {
      filename: "/repo/src/some/other.ts",
      code: `
        prisma.opportunity.update({
          where: { id },
          data: { stage: "won" },
        });
      `,
    },
  ],

  invalid: [
    {
      filename: "/repo/src/app/page.tsx",
      code: `
        prisma.lead.update({
          where: { id },
          data: { consentMarketing: true },
        });
      `,
      errors: [{ messageId: "direct" }],
    },
    {
      filename: "/repo/src/something/else.ts",
      code: `
        prisma.contact.create({
          data: { firstName: "x", lastName: "y", consentTracking: true },
        });
      `,
      errors: [{ messageId: "direct" }],
    },
    {
      filename: "/repo/src/background/worker.ts",
      code: `
        tx.contact.upsert({
          where: { id },
          create: { firstName: "a", lastName: "b", consentMarketing: true },
          update: { name: "x" },
        });
      `,
      errors: [{ messageId: "direct" }],
    },
  ],
});

console.log("no-direct-consent-write: tests passed");
