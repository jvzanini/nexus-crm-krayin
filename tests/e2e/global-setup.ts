import { chromium, FullConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import { E2E_USERS, E2E_PASSWORD, type E2ERole } from "./fixtures/e2e-users";

async function loginRole(baseURL: string, role: E2ERole, storagePath: string) {
  const user = E2E_USERS[role];
  const maxAttempts = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    try {
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', E2E_PASSWORD);
      await Promise.all([
        page.waitForURL(
          (url) => !url.pathname.startsWith("/login"),
          { timeout: 90_000 },
        ),
        page.click('button[type="submit"]'),
      ]);
      await ctx.storageState({ path: storagePath });
      await browser.close();
      return;
    } catch (err) {
      const url = page.url();
      const errorBox = await page
        .getByText(/inválid|erro|invalid|error/i)
        .first()
        .textContent()
        .catch(() => null);
      console.error(
        `[global-setup] login ${role} attempt ${attempt}/${maxAttempts} timeout — url=${url} errorBox=${errorBox}`,
      );
      lastErr = err;
      await browser.close().catch(() => {});
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  }
  throw lastErr;
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:3000";
  const authDir = path.resolve(__dirname, ".auth");
  await fs.mkdir(authDir, { recursive: true });

  const roles: E2ERole[] = ["admin", "manager", "viewer"];
  for (const role of roles) {
    const storagePath = path.join(authDir, `${role}.json`);
    await loginRole(baseURL, role, storagePath);
    console.log(`[global-setup] storage state: ${role} → ${storagePath}`);
  }
}
