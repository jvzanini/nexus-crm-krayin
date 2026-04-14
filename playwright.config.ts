import { defineConfig } from "@playwright/test";

const SKIP_AUTH = process.env.SKIP_AUTH_E2E === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  // Mantém nomes de snapshot sem sufixo de project (preserva snapshots pré-Frente 13).
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}{-platform}{ext}",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "unauth",
      testMatch: /(ds-preview|users-redirect|companies-redirect)\.spec\.ts/,
    },
    ...(SKIP_AUTH
      ? []
      : [
          {
            name: "authenticated",
            testMatch: /authenticated\/.*\.spec\.ts/,
            dependencies: ["setup"],
            use: { storageState: ".auth/user.json" },
          },
        ]),
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DS_PREVIEW: "true",
    },
  },
});
