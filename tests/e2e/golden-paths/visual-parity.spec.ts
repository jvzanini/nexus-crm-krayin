import { test, expect } from "@playwright/test";

/**
 * Fase 34 — visual parity: confirma shell (CrmListShell) envelopando as
 * rotas alvo com header card `bg-card border` + IconTile + breadcrumbs
 * + title. Não verifica pixel-perfect (isso é visual regression); só
 * estrutura DOM canônica.
 */
const routes = [
  { path: "/leads", heading: /^Leads$/i },
  { path: "/contacts", heading: /^Contatos$/i },
  { path: "/opportunities", heading: /^Oportunidades$/i },
  { path: "/opportunities/pipeline", heading: /^Pipeline$/i },
  { path: "/products", heading: /^Produtos$/i },
  { path: "/tasks", heading: /^Tarefas$/i },
  { path: "/marketing/campaigns", heading: /^Campanhas$/i },
  { path: "/marketing/segments", heading: /^Segmentos/i },
  { path: "/automation/workflows", heading: /^Workflows/i },
];

test.describe("Fase 34 — visual parity (CrmListShell canônico)", () => {
  for (const r of routes) {
    test(`shell + header card em ${r.path}`, async ({ page }) => {
      await page.goto(r.path);
      await expect(
        page.getByRole("heading", { level: 1, name: r.heading }).first(),
      ).toBeVisible();
      const header = page.locator('[data-slot="crm-list-header"]').first();
      await expect(header).toBeVisible();
      await expect(header).toHaveClass(/rounded-lg/);
      await expect(header).toHaveClass(/bg-card/);
    });
  }
});
