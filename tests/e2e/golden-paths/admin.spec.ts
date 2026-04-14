import { test, expect } from "@playwright/test";

test.describe("admin golden path", () => {
  test("dashboard renderiza", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("/leads carrega", async ({ page }) => {
    await page.goto("/leads");
    await expect(page).toHaveURL(/\/leads/);
  });

  test("/contacts carrega", async ({ page }) => {
    await page.goto("/contacts");
    await expect(page).toHaveURL(/\/contacts/);
  });

  test("/opportunities carrega", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page).toHaveURL(/\/opportunities/);
  });

  test("/products carrega", async ({ page }) => {
    await page.goto("/products");
    await expect(page).toHaveURL(/\/products/);
  });

  test("/users carrega e mostra botão criar", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL(/\/users/);
    const createBtn = page.getByRole("button", {
      name: /novo|adicionar|criar/i,
    });
    await expect(createBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("/settings/flags carrega (flags:manage)", async ({ page }) => {
    await page.goto("/settings/flags");
    await expect(page).toHaveURL(/\/settings\/flags/);
  });
});
