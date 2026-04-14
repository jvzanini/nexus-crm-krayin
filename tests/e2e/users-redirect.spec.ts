import { test, expect } from "@playwright/test";

test("/users redireciona unauth para /login", async ({ page }) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
});
