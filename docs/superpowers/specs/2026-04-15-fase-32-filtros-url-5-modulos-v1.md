# Spec Fase 32 — Filtros URL em products/tasks/campaigns/segments/workflows (v1)

**Data:** 2026-04-15 (tarde)
**Versão:** v1 (rascunho inicial)
**Autor:** Claude Opus 4.6 (sessão autônoma)
**Status:** rascunho — aguardando review #1

## 1. Objetivo

Fechar a opção **G** do HANDOFF (§0): estender o padrão canônico de
**URL-based filters** (já consolidado em leads/contacts/opportunities
pela Fase 24) para os 5 módulos restantes com bulk delete já entregue
(Fases 26-31):

- `/products`
- `/tasks`
- `/marketing/campaigns`
- `/marketing/segments`
- `/automation/workflows`

Bulk delete **já está presente** nos 5. Falta apenas FilterBar +
searchParams na page + Server Action aceitando `filters` estruturado.

## 2. Contexto + padrão canônico (memory `filters_bulk_pattern.md`)

**Page Server Component** awaita `searchParams`, parseia para
`initialFilters`, passa para Content (Client).

**Content Client:** state local `filters`, `useEffect` por campo dispara
`router.replace(URLSearchParams)` + refetch do Server Action.

**FilterBar** (`src/components/tables/filter-bar.tsx`): 3 tipos
(`select`, `input`, `date`). Props: `filters`, `onChange`, `onClear`,
`hasActive`, `customFilters`.

**Server Action** template:

```ts
export async function getEntity(filters?: EntityFilters) {
  const companyId = await requireActiveCompanyId();
  const where: Prisma.EntityWhereInput = { companyId };
  if (filters?.status) where.status = filters.status;
  if (filters?.q) where.OR = [ /* fields */ ];
  if (filters?.from) where.createdAt = { ...where.createdAt, gte: new Date(filters.from) };
  if (filters?.to)   where.createdAt = { ...where.createdAt, lte: new Date(filters.to) };
  return { success: true, data: await prisma.entity.findMany({ where, orderBy: ... }) };
}
```

Defense-in-depth: `companyId` SEMPRE presente mesmo com `id in [...]`.

## 3. Escopo por módulo

| # | Módulo | Action atual | Filtros novos | Refactor Action? |
|---|--------|--------------|---------------|------------------|
| 1 | Products | `listProducts({active?, q?, category?})` | q, active, category | **Não** (já aceita) — só UI |
| 2 | Tasks | `listMyTasks({status?, dueWithinDays?})` | status, dueWithinDays, q, assigneeId | **Sim** (novo `listActivities` admin-scope) |
| 3 | Campaigns | `listCampaignsAction()` (zero args) | status, q, from, to | **Sim** |
| 4 | Segments | `listSegmentsAction()` (zero args) | q, from, to | **Sim** |
| 5 | Workflows | `listWorkflowsAction()` (zero args) | status, trigger, q | **Sim** |

### 3.1. Products

- Página: `src/app/(protected)/products/page.tsx` — awaitar searchParams.
- Filtros:
  - `q` (input) — nome/SKU (OR contains insensitive)
  - `active` (select) — `all | active | inactive`
  - `category` (select, dinâmico) — categorias distintas da company
- Content: `src/app/(protected)/products/products-content.tsx` — FilterBar + useEffect.

### 3.2. Tasks

Hoje `/tasks` usa `listMyTasks(userId)`. Para Fase 32:
- Manter `listMyTasks` como default quando nenhum filter passado
  (comportamento atual — tela "Minhas tarefas").
- **Novo comportamento:** quando houver filter `assigneeId=all` ou user
  com `activities:view` amplo (admin/manager), mostrar TODAS tasks da
  company com filtros: `status`, `assigneeId`, `dueWithinDays`, `q`
  (title/description).
- Filtros UI:
  - `status` (select) — `all | pending | in_progress | completed | canceled`
  - `assigneeId` (select) — dropdown de membros da company + "Todos" / "Minhas"
  - `dueWithinDays` (select) — `all | today | 7 | 30`
  - `q` (input)

### 3.3. Campaigns

- `listCampaignsAction({status?, q?, from?, to?})` — refactor.
- Filtros:
  - `status` (select) — allowlist: `all | draft | scheduled | sending | running | paused | completed | canceled`
  - `q` (input) — nome campanha
  - `from` / `to` (date) — `createdAt` range

### 3.4. Segments

- `listSegmentsAction({q?, from?, to?})` — refactor.
- Filtros:
  - `q` (input) — nome do segmento
  - `from` / `to` (date)

### 3.5. Workflows

- `listWorkflowsAction({status?, trigger?, q?})` — refactor.
- Filtros:
  - `status` (select) — `all | active | paused | draft`
  - `trigger` (select) — `all | lead_created | contact_created | activity_completed`
  - `q` (input) — nome workflow

## 4. Fora de escopo

- Bulk delete (já entregue Fases 26-31).
- Bulk edit adicional (Fases 29-31 cobriram; estender noutra fase se necessário).
- Saved filters (opção **I** do HANDOFF, fase separada).
- Custom attributes filter nesses módulos (Fase 5 cobriu leads/contacts/opps apenas).
- Filtros server-scoped RBAC além do já existente (tenant scope preservado).

## 5. Critérios de aceitação

1. Os 5 módulos têm FilterBar visível acima da tabela.
2. Alterar filtro atualiza URL via `router.replace` (URLSearchParams) e refetch do action retorna apenas os itens filtrados.
3. Botão "Limpar" reseta filtros e remove params da URL.
4. Voltar pela navegação (back) restaura os filtros anteriores (URL como source of truth).
5. `companyId` sempre presente no `where` (defense-in-depth).
6. Testes Vitest cobrem pelo menos 1 caso por Server Action refactored (where-clause com múltiplos filters).
7. Pelo menos 1 E2E Playwright por módulo (applyFilter + clearFilter).
8. `npm run build`, `npm run test`, `npm run typecheck` verdes.
9. Prod smoke OK após deploy (`/login` 200, `/api/health` 200).

## 6. Riscos

- **R1 — Tasks refactor quebra "Minhas tarefas":** manter default para
  usuários sem filter = `listMyTasks(userId)`. Mitigação: branch na action.
- **R2 — Category dinâmica em products N+1:** query distinct categories antes do findMany. Mitigação: 1 query extra no Server Component.
- **R3 — Filtros adicionados a actions com performance penalty:** índices existentes (status, companyId) cobrem casos comuns. Se `q` virar gargalo, considerar pg_trgm em follow-up (já tracked em memória).
- **R4 — URL muito grande em filtros acumulados:** Next.js tolera bem; 8 módulos × 4 filters cada é trivial.

## 7. Estimativa

- 5 módulos × (~30 min refactor action + ~40 min page/content + ~20 min testes) = ~3h30 em modo autônomo com subagents paralelos.
- Paralelização: action refactors + page updates podem rodar em 2-3 subagents simultâneos por módulo independente.

## 8. Artefatos

- Spec: `docs/superpowers/specs/2026-04-15-fase-32-filtros-url-5-modulos-v3.md` (final).
- Plan: `docs/superpowers/plans/2026-04-15-fase-32-filtros-url-5-modulos-v3.md` (final).
- Tag: `phase-32-filtros-url-5-modulos-deployed`.
- Memory: atualizar `filters_bulk_pattern.md` com expansão para 5 módulos.
