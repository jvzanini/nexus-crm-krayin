# Plan — Fase 23 Reports

**Spec:** `docs/superpowers/specs/2026-04-15-fase-23-reports-design.md`
**Tag:** `phase-23-reports-deployed`

## Tasks

### T1 — Server Action + CSV util

**Novos arquivos:**

- `src/lib/actions/reports.ts` — `getReportsData(filter)` com 4 sub-queries
  em paralelo. RBAC `audit:view`. Tenant scope `requireActiveCompanyId`.
- `src/lib/reports/csv-export.ts` — `toCSV<T>(rows: T[]): string` + helper
  `downloadCSV(filename, rows)` (client-side, cria blob + a.download).

Commits atômicos:
- `feat(reports): getReportsData action + 4 datasets`
- `feat(reports): csv-export util`

### T2 — Page + Loading + Content

**Novos arquivos:**

- `src/app/(protected)/reports/page.tsx` — Server Component, chama
  `getReportsData({periodDays: 30})` padrão, passa para content.
- `src/app/(protected)/reports/loading.tsx` — skeleton 4 cards.
- `src/app/(protected)/reports/_components/reports-content.tsx` — Client,
  PageHeader "Relatórios" + PeriodFilter + grid 2×2 (md) / stack (mobile)
  dos 4 cards.

### T3 — 4 cards

**Novos arquivos em `src/app/(protected)/reports/_components/`:**

- `revenue-forecast-card.tsx` — AreaChart Recharts, stacked por stage.
- `opps-by-source-card.tsx` — BarChart horizontal com taxa de conversão.
- `owner-performance-card.tsx` — tabela ranking (shadcn Table).
- `pipeline-evolution-card.tsx` — LineChart Recharts com banner
  "⚠️ Dados estimados — snapshot semanal será implementado em Fase 23b".

Cada card tem:
- Título + descrição curta
- Export CSV button (top-right)
- Skeleton loading (quando period muda)
- Empty state se zero dados

### T4 — Period filter

**Novo arquivo:** `src/app/(protected)/reports/_components/period-filter.tsx`

Client component com Select do DS (ou custom) com opções:
- Últimos 7 dias
- Últimos 30 dias (padrão)
- Últimos 90 dias
- Últimos 365 dias
- Personalizado (2 date pickers — deixar TODO para 23b se complexo)

Ao mudar, chama `startTransition` e re-fetch via `useRouter.refresh()` ou
Server Action update.

### T5 — Sidebar

Editar `src/lib/constants/navigation.ts`:

```ts
{ label: "Relatórios", href: "/reports", icon: BarChart3, allowedRoles: ["super_admin", "admin", "manager"] },
```

Inserir nos `RESTRICTED_NAV_ITEMS` antes de "Usuários".

### T6 — E2E spec

**Novo arquivo:** `tests/e2e/golden-paths/reports.spec.ts`

```ts
test("admin acessa /reports", async ({ page }) => {
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/reports/);
  await expect(page.getByText("Relatórios")).toBeVisible();
});

test("manager acessa /reports", ...)  // via project=manager

test("viewer bloqueado em /reports", ...)  // redirect expected
```

Adicionar `reports` ao regex admin/manager em `playwright.config.ts`.

### T7 — Build + push + tag

```sh
npm run build
git push origin main
git tag phase-23-reports-deployed
git push origin phase-23-reports-deployed
```

## Execução

Por enquanto: sequencial, commits atômicos. Cada card pode ser paralelizado
se delegar aos subagents. **Recomendado:** fazer T1+T2 primeiro (esqueleto),
depois paralelizar T3 (4 cards) em subagents.

## Rollback

Cada card é arquivo isolado. Revert granular possível.
Se query pesada em prod causa timeout, desabilitar card específico com
feature flag `reports:revenue-forecast:enabled`.
