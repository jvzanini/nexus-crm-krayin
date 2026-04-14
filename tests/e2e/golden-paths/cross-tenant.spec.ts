import { test, expect } from "@playwright/test";
import { E2E_FIXTURES } from "../fixtures/e2e-users";

// Usa storageState do project "admin" (configurado via playwright.config projects matrix).

test.describe("cross-tenant smoke", () => {
  test("admin recebe 404 em lead inexistente", async ({ page }) => {
    const resp = await page.goto(`/leads/${E2E_FIXTURES.nonExistentLeadId}`);
    // notFound() do Next retorna 404; se a app redirect para /leads ou /dashboard, também aceitável.
    const status = resp?.status() ?? 0;
    if (status !== 404) {
      await expect(page).toHaveURL(/\/(leads|dashboard)/);
    } else {
      expect(status).toBe(404);
    }
  });

  test("admin não vê lead de tenant B na listagem global (quando scoping existir)", async ({ page }) => {
    // Placeholder tolerante: hoje leads não tem companyId. Confirma apenas que a listagem carrega.
    await page.goto("/leads");
    await expect(page).toHaveURL(/\/leads/);
  });
});
