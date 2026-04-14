import { test, expect } from "@playwright/test";

test("/companies redireciona unauth para /login", async ({ page }) => {
  await page.goto("/companies");
  await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
});
