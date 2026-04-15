import { test, expect } from "@playwright/test";

test.describe("reports (admin/manager)", () => {
  test("/reports carrega", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.getByRole("heading", { name: /Relatórios/i })).toBeVisible();
  });
});
