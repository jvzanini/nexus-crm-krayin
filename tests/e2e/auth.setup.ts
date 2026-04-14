import { test as setup } from "@playwright/test";

const STORAGE_STATE = ".auth/user.json";

const EMAIL =
  process.env.E2E_USER_EMAIL ??
  process.env.ADMIN_EMAIL ??
  "admin@nexus.local";
const PASSWORD =
  process.env.E2E_USER_PASSWORD ??
  process.env.ADMIN_PASSWORD ??
  "admin123";

setup("autenticar usuário admin", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await page.context().storageState({ path: STORAGE_STATE });
});
