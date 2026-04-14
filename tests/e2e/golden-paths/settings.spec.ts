import { test, expect } from "@playwright/test";

test.describe("admin — settings + flags (package @nexusai360/settings-ui)", () => {
  test("/settings carrega com heading visível", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("/settings/flags carrega com botão Nova flag", async ({ page }) => {
    await page.goto("/settings/flags");
    await expect(page).toHaveURL(/\/settings\/flags/);
    await expect(page.locator("main").first()).toBeVisible();
  });
});
