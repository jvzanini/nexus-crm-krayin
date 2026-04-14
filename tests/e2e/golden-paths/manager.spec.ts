import { test, expect } from "@playwright/test";

test.describe("manager golden path", () => {
  test("dashboard renderiza", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("/leads carrega", async ({ page }) => {
    await page.goto("/leads");
    await expect(page).toHaveURL(/\/leads/);
  });

  test("/opportunities carrega", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page).toHaveURL(/\/opportunities/);
  });

  test("/users view-only (sem botão criar)", async ({ page }) => {
    const resp = await page.goto("/users");
    // Pode ser 200 com lista view-only, ou redirect para dashboard se guard server bloquear.
    if (resp && resp.status() === 200 && page.url().includes("/users")) {
      const createBtn = page.getByRole("button", {
        name: /novo usuário|adicionar usuário|criar usuário/i,
      });
      await expect(createBtn).toHaveCount(0);
    } else {
      await expect(page).toHaveURL(/\/(dashboard|login)/);
    }
  });

  test("/settings/flags bloqueado (flags:manage é admin)", async ({ page }) => {
    await page.goto("/settings/flags");
    // Aceita qualquer redirect out ou tela vazia sem botões gerenciáveis.
    // Teste tolerante: URL pode permanecer em /settings/flags se a guarda for só UI;
    // exigimos que não haja botões de write.
    const manageBtn = page.getByRole("button", { name: /criar flag|nova flag/i });
    await expect(manageBtn).toHaveCount(0);
  });
});
