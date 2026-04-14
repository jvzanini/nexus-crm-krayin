import { test, expect } from "@playwright/test";

test.describe("pipeline golden path (admin)", () => {
  test("navegação lista -> pipeline", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByRole("link", { name: /pipeline/i }).first().click();
    await expect(page).toHaveURL(/\/opportunities\/pipeline/);
  });

  test("pipeline renderiza 6 colunas", async ({ page }) => {
    await page.goto("/opportunities/pipeline");
    for (const label of [
      "Prospecção",
      "Qualificação",
      "Proposta",
      "Negociação",
      "Ganho",
      "Perdido",
    ]) {
      await expect(
        page
          .getByRole("heading", { name: label })
          .or(page.getByText(label).first())
      ).toBeVisible();
    }
  });
});
