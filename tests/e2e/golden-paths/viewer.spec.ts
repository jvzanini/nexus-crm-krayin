import { test, expect } from "@playwright/test";

test.describe("viewer golden path", () => {
  test("dashboard renderiza", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("/leads read-only (sem botão criar)", async ({ page }) => {
    await page.goto("/leads");
    await expect(page).toHaveURL(/\/leads/);
    const createBtn = page.getByRole("button", {
      name: /novo lead|criar lead|adicionar lead/i,
    });
    await expect(createBtn).toHaveCount(0);
  });

  test("/contacts read-only", async ({ page }) => {
    await page.goto("/contacts");
    const createBtn = page.getByRole("button", {
      name: /novo contato|criar contato|adicionar contato/i,
    });
    await expect(createBtn).toHaveCount(0);
  });

  test("/opportunities read-only", async ({ page }) => {
    await page.goto("/opportunities");
    const createBtn = page.getByRole("button", {
      name: /nova oportunidade|criar oportunidade|adicionar oportunidade/i,
    });
    await expect(createBtn).toHaveCount(0);
  });

  test("/settings/flags sem capacidade de manage", async ({ page }) => {
    await page.goto("/settings/flags");
    const manageBtn = page.getByRole("button", { name: /criar flag|nova flag/i });
    await expect(manageBtn).toHaveCount(0);
  });
});
