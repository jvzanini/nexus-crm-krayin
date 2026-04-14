import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
const themes = ["light", "dark"] as const;

for (const vp of viewports) {
  for (const theme of themes) {
    test(`ds-preview ${vp.name} ${theme} — axe + visual`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/__ds-preview");
      await page.evaluate((t) => {
        document.documentElement.classList.toggle("dark", t === "dark");
      }, theme);

      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(critical).toEqual([]);

      // Visual regression desabilitada em CI — baselines gerados em darwin,
      // CI roda linux (snapshots por plataforma). Reativar quando pipeline
      // gerar baseline linux dedicado.
      if (!process.env.CI) {
        await expect(page).toHaveScreenshot(
          `ds-preview-${vp.name}-${theme}.png`,
          { maxDiffPixels: 100 },
        );
      }
    });
  }
}
