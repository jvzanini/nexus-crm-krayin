import { test, expect } from "@playwright/test";

/**
 * E2E — Custom Attributes (Fase 5 / T22 do plano).
 *
 * Sete cenários cobrindo CRUD, uso em lead, filtros, RBAC, feature flag,
 * cross-tenant isolation e unique constraint. Cenários que exigem fixtures
 * ainda não disponíveis (viewer com seed de attrs, toggle de flag por env,
 * seed de attrs por tenant distinto) são marcados como skip documentado.
 *
 * Project matrix (playwright.config.ts): este arquivo roda sob storageState
 * "admin" para cenários 1/2/3/5/6/7 e precisa de storageState "viewer" para
 * o cenário 4 — testes viewer rodam num describe separado filtrado pelo
 * projeto "viewer".
 */

const projectName = test.info.name ? "" : "";
void projectName;

test.describe("Custom Attributes — admin CRUD e uso", () => {
  test.skip(
    ({}, testInfo) => testInfo.project.name !== "admin",
    "apenas no project admin",
  );

  test("1. admin CRUD happy (criar/editar/excluir attr MRR)", async ({
    page,
  }) => {
    await page.goto("/settings/custom-attributes");
    await expect(page).toHaveURL(/\/settings\/custom-attributes/);

    // Tab Lead
    const leadTab = page.getByRole("tab", { name: /lead/i }).first();
    if (await leadTab.count()) await leadTab.click();

    // Novo atributo
    await page.getByRole("button", { name: /novo atributo|criar atributo/i }).click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/key|chave/i).fill("mrr");
    // tipo=number via select/radio — tentamos ambos
    const typeSelect = dialog.getByLabel(/tipo|type/i).first();
    if (await typeSelect.count()) {
      await typeSelect.selectOption({ label: "Number" }).catch(async () => {
        await typeSelect.click();
        await page.getByRole("option", { name: /number|número/i }).click();
      });
    }
    await dialog.getByLabel(/label|rótulo/i).fill("MRR");
    await dialog.getByRole("button", { name: /salvar|criar/i }).click();

    await expect(page.getByText(/MRR/).first()).toBeVisible({ timeout: 10_000 });

    // Editar label
    const row = page.locator("tr", { hasText: "MRR" }).first();
    await row.getByRole("button", { name: /editar/i }).click();
    const editDialog = page.getByRole("dialog").first();
    await editDialog.getByLabel(/label|rótulo/i).fill("MRR (USD)");
    await editDialog.getByRole("button", { name: /salvar/i }).click();
    await expect(page.getByText("MRR (USD)").first()).toBeVisible();

    // Excluir
    const rowAfter = page.locator("tr", { hasText: "MRR (USD)" }).first();
    await rowAfter.getByRole("button", { name: /excluir|deletar|remover/i }).click();
    const confirmDialog = page.getByRole("alertdialog").first();
    await confirmDialog.getByRole("button", { name: /confirmar|excluir|sim/i }).click();

    await expect(page.getByText("MRR (USD)")).toHaveCount(0);
  });

  test("2. admin cria attr e usa em novo lead", async ({ page }) => {
    await page.goto("/settings/custom-attributes");

    await page.getByRole("button", { name: /novo atributo|criar atributo/i }).click();
    const dialog = page.getByRole("dialog").first();
    await dialog.getByLabel(/key|chave/i).fill("fonte_origem");
    await dialog.getByLabel(/label|rótulo/i).fill("Fonte de origem");
    // visibleInList = true
    const visibleToggle = dialog.getByLabel(/vis[íi]vel na lista|visible in list/i);
    if (await visibleToggle.count()) await visibleToggle.check();
    await dialog.getByRole("button", { name: /salvar|criar/i }).click();
    await expect(page.getByText("Fonte de origem").first()).toBeVisible();

    // Novo lead
    await page.goto("/leads");
    await page.getByRole("button", { name: /novo lead|criar lead/i }).first().click();

    const leadDialog = page.getByRole("dialog").first();
    await expect(leadDialog.getByLabel(/fonte de origem/i)).toBeVisible();
    await leadDialog.getByLabel(/fonte de origem/i).fill("Website");

    // preenche campos obrigatórios mínimos
    const titleField = leadDialog.getByLabel(/t[íi]tulo|nome/i).first();
    if (await titleField.count()) await titleField.fill("Lead E2E fonte_origem");
    await leadDialog.getByRole("button", { name: /salvar|criar/i }).click();

    await expect(page.getByText("Website").first()).toBeVisible({ timeout: 10_000 });
  });

  test("3. filtros cf[mrr][gte]=1000 retornam apenas leads >= 1000", async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_CUSTOM_ATTRS_SEED,
      "requer seed idempotente de attr mrr + 3 leads (500/1500/2500) — ver follow-up T23",
    );

    await page.goto("/leads?cf[mrr][gte]=1000");
    const rows = page.locator("tbody tr");
    // espera 2 leads (1500 e 2500)
    await expect(rows).toHaveCount(2);
    await expect(page.getByText("500")).toHaveCount(0);
  });

  test("5. feature flag OFF → /settings/custom-attributes retorna 404", async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_FLAG_TOGGLE,
      "requer controle de flag feature.custom_attributes via env/API admin",
    );

    const resp = await page.goto("/settings/custom-attributes");
    expect(resp?.status()).toBe(404);
  });

  test("6. cross-tenant isolation — tenant B não vê attr do tenant A", async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_TENANT_B_SESSION,
      "requer storageState de tenant B + seed de attr em tenant A — ver follow-up T23",
    );

    await page.goto("/settings/custom-attributes");
    await expect(page.getByText("mrr")).toHaveCount(0);
  });

  test("7. unique constraint — duplicar CPF retorna erro", async ({ page }) => {
    await page.goto("/settings/custom-attributes");
    await page.getByRole("button", { name: /novo atributo|criar atributo/i }).click();
    const dialog = page.getByRole("dialog").first();
    await dialog.getByLabel(/key|chave/i).fill("cpf");
    await dialog.getByLabel(/label|rótulo/i).fill("CPF");
    const uniqueToggle = dialog.getByLabel(/[úu]nico|unique/i);
    if (await uniqueToggle.count()) await uniqueToggle.check();
    await dialog.getByRole("button", { name: /salvar|criar/i }).click();
    await expect(page.getByText("CPF").first()).toBeVisible();

    // Lead 1 com cpf 123
    await page.goto("/leads");
    await page.getByRole("button", { name: /novo lead|criar lead/i }).first().click();
    let leadDialog = page.getByRole("dialog").first();
    const title1 = leadDialog.getByLabel(/t[íi]tulo|nome/i).first();
    if (await title1.count()) await title1.fill("Lead CPF 1");
    await leadDialog.getByLabel(/cpf/i).fill("123");
    await leadDialog.getByRole("button", { name: /salvar|criar/i }).click();
    await expect(page.getByText("Lead CPF 1").first()).toBeVisible({ timeout: 10_000 });

    // Lead 2 com mesmo cpf → esperar erro
    await page.getByRole("button", { name: /novo lead|criar lead/i }).first().click();
    leadDialog = page.getByRole("dialog").first();
    const title2 = leadDialog.getByLabel(/t[íi]tulo|nome/i).first();
    if (await title2.count()) await title2.fill("Lead CPF 2");
    await leadDialog.getByLabel(/cpf/i).fill("123");
    await leadDialog.getByRole("button", { name: /salvar|criar/i }).click();

    await expect(
      page.getByText(/valor duplicado em cpf|duplicate|j[áa] existe/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Custom Attributes — viewer read-only", () => {
  test.skip(
    ({}, testInfo) => testInfo.project.name !== "viewer",
    "apenas no project viewer",
  );

  test("4. viewer vê listagem mas não vê botões de ação", async ({ page }) => {
    await page.goto("/settings/custom-attributes");
    await expect(page).toHaveURL(/\/settings\/custom-attributes/);

    await expect(
      page.getByRole("button", { name: /novo atributo|criar atributo/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^editar$/i })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /excluir|deletar|remover/i }),
    ).toHaveCount(0);
  });
});
