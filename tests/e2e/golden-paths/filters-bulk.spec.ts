import { test, expect } from "@playwright/test";

test.describe("filters + bulk [admin]", () => {
  test("/leads aceita filter via URL", async ({ page }) => {
    await page.goto("/leads?status=new");
    await expect(page).toHaveURL(/status=new/);
  });

  test("/contacts aceita filter via URL", async ({ page }) => {
    await page.goto("/contacts?q=test");
    await expect(page).toHaveURL(/q=test/);
  });

  test("/opportunities aceita filter via URL", async ({ page }) => {
    await page.goto("/opportunities?stage=proposal");
    await expect(page).toHaveURL(/stage=proposal/);
  });
});
