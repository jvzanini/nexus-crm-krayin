# Plan Fase 32 — Filtros URL em 5 módulos (v2 pós-review #1)

**Spec:** `docs/superpowers/specs/2026-04-15-fase-32-filtros-url-5-modulos-v3.md`.

## Mudanças vs v1

- Tasks v1 tinham 5+ sub-steps implícitos → v2 quebra em ~35 tasks atômicas.
- Ordenação de dependências explícita.
- Critério de sucesso por task.
- Arquivos exatos listados.
- Paralelização identificada (grupos A/B/C independentes).

## 0. Preparação

### T0.1 — Verificar `requireCompanyRole` existe
**Arquivo:** `src/lib/rbac/*.ts`
**Ação:** grep por `requireCompanyRole`; se ausente, criar função em `src/lib/rbac/company-role.ts` que lê `session.user.activeCompanyRole` e lança `ForbiddenError` se não estiver em roles permitidas.
**Sucesso:** função importável de `@/lib/rbac/company-role`.

### T0.2 — Verificar `useDebouncedValue` hook
**Arquivo:** `src/lib/hooks/use-debounced-value.ts` (criar se ausente)
**Ação:** hook `useDebouncedValue<T>(value, delayMs): T` com useState + useEffect + setTimeout/clearTimeout.
**Sucesso:** hook importável; teste Vitest bonus (debounce respeita delay).

### T0.3 — Confirmar RBAC atual de cada action
**Arquivo:** grep `requirePermission` em `src/lib/actions/{products,activities,marketing-campaigns,marketing-segments,workflows}.ts`
**Ação:** documentar no próprio plan os nomes exatos.
**Sucesso:** lista completa.

## Grupo A — Products (paralelizável)

### T-PROD.1 — Schema Zod
**Arquivo novo:** `src/lib/actions/products-schemas.ts`
**Exports:** `ProductsFiltersSchema`, `ProductsFilters`.
**Sucesso:** `z.object({ q?, active?, category? })`.

### T-PROD.2 — Action refactor
**Arquivo:** `src/lib/actions/products.ts`
**Mudanças:**
- `listProducts(raw?: unknown)`: `safeParse(raw)` → build `where` com `q`/`active`/`category`.
- Novo export `listDistinctCategories()`: `prisma.product.findMany({ where:{companyId, category:{not:null}}, distinct:["category"], select:{category:true}, orderBy:{category:"asc"} })`.
**Sucesso:** typecheck passa; test composto com 3 filtros passa.

### T-PROD.3 — Page
**Arquivo:** `src/app/(protected)/products/page.tsx`
**Mudanças:**
- Tipar `searchParams: Promise<Record<string,string|undefined>>`.
- `const params = await searchParams; const result = await listProducts(params); const cats = await listDistinctCategories();`.
- Passar `initialFilters={params} categoryOptions={cats}` para content.
**Sucesso:** page renderiza sem erro; `/products?active=active` filtra.

### T-PROD.4 — Content
**Arquivo:** `src/app/(protected)/products/products-content.tsx`
**Mudanças:**
- `"use client"` (já é).
- Importar `FilterBar`, `ProductsFiltersSchema`, `useDebouncedValue`.
- State `filters` com `safeParse(initialFilters)`.
- useEffect observando campos individuais → `router.replace` + refetch.
- FilterBar acima da tabela (3 filters: input q, select active, select category dinâmico).
- Empty state condicional.
**Sucesso:** UI mostra filters; apply/clear funcionam; selectedIds limpa no change.

### T-PROD.5 — Test Vitest
**Arquivo novo:** `src/lib/actions/__tests__/products-filters.test.ts`
**Casos:**
- `listProducts({ q:"abc" })` monta `where.OR`.
- `listProducts({ active:"inactive" })` → `where.active=false`.
- `listProducts({ category:"X" })` → `where.category="X"`.
- `listProducts({ q:"<script>", active:"hack" })` → ignora (`safeParse` fail).
**Sucesso:** 4 assertions passam; mock Prisma via vi.mock.

## Grupo B — Tasks (paralelizável)

### T-TASK.1 — Schema Zod
**Arquivo:** `src/lib/actions/activities-schemas.ts` (estender ou criar)
**Exports:** `TasksFiltersSchema`, `TasksFilters`.
**Fields:** `q?`, `status?` (ActivityStatus), `assigneeScope?` (enum: `me`/`all`/uuid), `dueWithinDays?` (enum: `overdue`/`today`/`7`/`30`).

### T-TASK.2 — Action novo `listTasks`
**Arquivo:** `src/lib/actions/activities.ts`
**Ação:** novo `listTasks(raw?)` com lógica completa (§3.2 do spec).
**RBAC:**
- Base: `requirePermission("activities:view")`.
- `assigneeScope==="all"`: adicional `requireCompanyRole(["admin","manager"])`.
**Sucesso:** typecheck passa.

### T-TASK.3 — `listMyTasks` → wrapper
**Arquivo:** `src/lib/actions/activities.ts:190`
**Ação:** substituir body por `return listTasks({ ...filter, assigneeScope:"me" })`.
Adicionar JSDoc `@deprecated use listTasks({assigneeScope:"me"})` opcional.
**Sucesso:** tasks-content.tsx continua funcionando sem mudança.

### T-TASK.4 — `getCompanyAssignees`
**Verificar:** action `getCompanyAssignees()` existe (Fase 31 bulk assign criou). Reaproveitar.
**Se ausente:** criar em `src/lib/actions/users.ts` listando memberships ativos.

### T-TASK.5 — Page
**Arquivo:** `src/app/(protected)/tasks/page.tsx`
**Mudanças:** awaitar searchParams; chamar `listTasks(params)`; carregar `getCompanyAssignees()` para options.
**Sucesso:** `/tasks?status=pending` filtra.

### T-TASK.6 — Content
**Arquivo:** `src/app/(protected)/tasks/_components/tasks-content.tsx`
**Mudanças:** FilterBar 4 filters + useEffect + empty state + debounce.
**Nota:** UI de `assigneeScope=all` deve mostrar badge "Todas" ao invés de "Minhas".

### T-TASK.7 — Test Vitest
**Arquivo novo:** `src/lib/actions/__tests__/tasks-filters.test.ts`
**Casos:** `status`, `assigneeScope=me/all/uuid`, `dueWithinDays=overdue/today/7`.
**Sucesso:** 4+ asserts.

## Grupo C — Marketing Campaigns (paralelizável)

### T-CAMP.1 — Schema Zod
**Arquivo novo:** `src/lib/actions/marketing-campaigns-schemas.ts`
**Fields:** `q?`, `status?` (CampaignStatus), `from?`, `to?`.

### T-CAMP.2 — Action refactor
**Arquivo:** `src/lib/actions/marketing-campaigns.ts`
**Ação:** `listCampaignsAction(raw?)` aceita Zod parse, monta where com 4 filtros.
**Sucesso:** typecheck.

### T-CAMP.3 — Page
**Arquivo:** `src/app/(protected)/marketing/campaigns/page.tsx`
**Mudanças:** awaitar searchParams.

### T-CAMP.4 — Content
**Arquivo:** `src/app/(protected)/marketing/campaigns/campaigns-content.tsx`
**Mudanças:** FilterBar (q, status, from, to).

### T-CAMP.5 — Test
**Arquivo novo:** `src/lib/actions/__tests__/campaigns-filters.test.ts`.

## Grupo D — Marketing Segments (paralelizável)

### T-SEG.1 — Schema
**Arquivo novo:** `src/lib/actions/marketing-segments-schemas.ts`
**Fields:** `q?`, `from?`, `to?`.

### T-SEG.2 — Action
### T-SEG.3 — Page
### T-SEG.4 — Content (FilterBar: q, from, to)
### T-SEG.5 — Test

## Grupo E — Workflows (paralelizável)

### T-WF.1 — Schema
**Arquivo novo:** `src/lib/actions/workflows-schemas.ts`
**Fields:** `q?`, `status?` (WorkflowStatus), `trigger?` (WorkflowTrigger).

### T-WF.2 — Action
### T-WF.3 — Page
### T-WF.4 — Content (FilterBar: q, status, trigger)
### T-WF.5 — Test

## Grupo F — E2E Playwright

### T-E2E.1 — products
**Arquivo novo:** `tests/e2e/products-filters.spec.ts`
**Cobertura:** login admin; abrir /products; aplicar q + active; assert count; clear; assert count restaurado.

### T-E2E.2 — tasks
### T-E2E.3 — campaigns
### T-E2E.4 — segments
### T-E2E.5 — workflows

## Grupo Z — Verificação + deploy

### TZ.1 — `npm run lint`
### TZ.2 — `npm run typecheck`
### TZ.3 — `npm run test` (esperar ≥681 passed)
### TZ.4 — `npm run build`
### TZ.5 — `npm run test:e2e`
### TZ.6 — Commit + push (commits segmentados por grupo)
### TZ.7 — Monitorar CI (gh run watch)
### TZ.8 — Smoke prod (`/login`, `/api/health`, `/api/ready`)
### TZ.9 — Aplicar tag `phase-32-filtros-url-5-modulos-deployed`
### TZ.10 — Atualizar HANDOFF.md §0 (mover G para entregue, adicionar Fase 32 histórico)
### TZ.11 — Atualizar memory `filters_bulk_pattern.md`
### TZ.12 — Criar memory `session_state_2026_04_15_fase_32.md`

## Dependências

- T0.* → bloqueia todos os grupos.
- Grupos A-E independentes entre si (paralelizáveis via subagents).
- Grupo F depende de A-E.
- Grupo Z depende de F.

## Paralelização recomendada

- Rodada 1: T0.1 + T0.2 + T0.3 paralelas.
- Rodada 2: Grupo A + B + C em 3 subagents paralelos.
- Rodada 3: Grupo D + E em 2 subagents paralelos.
- Rodada 4: Grupo F (5 E2E em 1 subagent batch).
- Rodada 5: Grupo Z sequencial.

## Total tasks

~42 atômicas. Estimativa ~4h autônomo com paralelização.
