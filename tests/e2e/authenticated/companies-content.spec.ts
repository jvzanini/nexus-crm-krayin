import { test, expect } from "@playwright/test";

test("/companies renderiza para usuário autenticado", async ({ page }) => {
  await page.goto("/companies");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 5000 });
});
