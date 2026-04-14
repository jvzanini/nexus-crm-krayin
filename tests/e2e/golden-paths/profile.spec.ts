import { test, expect } from "@playwright/test";

test.describe("admin — profile (package @nexusai360/profile-ui)", () => {
  test("/profile carrega com heading visível", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.locator("main").first()).toBeVisible();
  });
});
