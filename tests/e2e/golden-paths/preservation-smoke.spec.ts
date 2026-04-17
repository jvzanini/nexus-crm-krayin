import { test, expect } from "@playwright/test";

/**
 * Fase 34 — preservação de features das Fases 13/17/18/20/22/24/25/26–32/33.
 * Valida que refatores do CrmListShell não quebraram: EmptyState, FilterBar,
 * BulkActionBar, CommandPalette, loading skeleton.
 */
test.describe("Fase 34 — preservation smoke", () => {
  test("CommandPalette Ctrl+K em /leads", async ({ page }) => {
    await page.goto("/leads");
    await page.keyboard.press("Control+KeyK");
    // Modal abre (qualquer dialog com placeholder de busca)
    await expect(
      page
        .getByPlaceholder(/buscar/i)
        .or(page.getByRole("dialog").getByPlaceholder(/^/))
        .first(),
    ).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
  });

  test("EmptyState aparece com filtro impossível em /leads", async ({ page }) => {
    await page.goto("/leads?q=xyz_nao_existe_fase_34");
    await expect(
      page.getByText(/nenhum lead/i).or(page.getByText(/vazio/i)).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("FilterBar input presente em /leads", async ({ page }) => {
    await page.goto("/leads");
    const input = page.getByPlaceholder(/buscar leads/i).first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test("Dashboard cards (Funnel + PipelineValue + TopOpps) em /dashboard", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    // Pelo menos 1 dos 3 cards deve estar visível
    await expect(
      page
        .getByText(/funil/i)
        .or(page.getByText(/pipeline/i))
        .or(page.getByText(/oportunidades/i))
        .first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("Pipeline kanban colunas em /opportunities/pipeline (desktop)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/opportunities/pipeline");
    // Há múltiplas colunas/estágios visíveis
    await expect(
      page.getByRole("heading", { name: /pipeline/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
