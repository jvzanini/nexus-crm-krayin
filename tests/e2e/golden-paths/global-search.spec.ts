import { test, expect } from "@playwright/test";

test.describe("busca global (admin)", () => {
  test("Ctrl+K abre palette e busca retorna grupos", async ({ page }) => {
    await page.goto("/dashboard");
    // abrir palette via atalho
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();

    const input = dialog.getByRole("textbox", { name: /busca global/i });
    await input.fill("lead");

    // aguarda debounce + fetch
    await page.waitForResponse(
      (r) => r.url().includes("/api/search?q=") && r.status() === 200,
      { timeout: 5_000 },
    );

    // deve aparecer pelo menos um resultado ou mensagem "Nenhum"
    const hasResults = await dialog
      .locator('[data-selected="true"], [cmdk-item]')
      .count()
      .then((c) => c > 0)
      .catch(() => false);
    const hasEmpty = await dialog
      .getByText(/Nenhum resultado|Não foi possível/i)
      .count()
      .then((c) => c > 0);

    expect(hasResults || hasEmpty).toBeTruthy();
  });

  test("Esc fecha palette", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
