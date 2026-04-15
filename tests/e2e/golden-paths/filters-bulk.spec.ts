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

  // Fase 32 — filtros URL em products/tasks/campaigns/segments/workflows
  test("/products aceita filter via URL", async ({ page }) => {
    await page.goto("/products?active=active");
    await expect(page).toHaveURL(/active=active/);
  });

  test("/tasks aceita filter via URL", async ({ page }) => {
    await page.goto("/tasks?status=pending");
    await expect(page).toHaveURL(/status=pending/);
  });

  test("/marketing/campaigns aceita filter via URL", async ({ page }) => {
    await page.goto("/marketing/campaigns?status=draft");
    await expect(page).toHaveURL(/status=draft/);
  });

  test("/marketing/segments aceita filter via URL", async ({ page }) => {
    await page.goto("/marketing/segments?q=vip");
    await expect(page).toHaveURL(/q=vip/);
  });

  test("/automation/workflows aceita filter via URL", async ({ page }) => {
    await page.goto("/automation/workflows?status=active");
    await expect(page).toHaveURL(/status=active/);
  });
});
