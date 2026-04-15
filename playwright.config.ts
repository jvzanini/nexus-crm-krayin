import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const authDir = path.resolve(__dirname, "tests/e2e/.auth");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  globalSetup: require.resolve("./tests/e2e/global-setup.ts"),
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "unauth",
      testMatch: /(companies-redirect|users-redirect|ds-preview)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "admin",
      testMatch: /golden-paths\/(admin|cross-tenant|pipeline|reports|filters-bulk|global-search)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(authDir, "admin.json"),
      },
    },
    {
      name: "manager",
      testMatch: /golden-paths\/(manager|reports)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(authDir, "manager.json"),
      },
    },
    {
      name: "viewer",
      testMatch: /golden-paths\/viewer\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(authDir, "viewer.json"),
      },
    },
  ],
  webServer: {
    // CI usa next start (build pré-feito no workflow) — ~instant per-route.
    // Local usa next dev para HMR durante desenvolvimento.
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { DS_PREVIEW: "true" },
  },
});
