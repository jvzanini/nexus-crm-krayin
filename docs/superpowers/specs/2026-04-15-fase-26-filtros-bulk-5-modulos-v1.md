# Spec v1 — Fase 26: Filtros URL + Bulk Delete nos 5 módulos restantes

**Status:** v1
**Data:** 2026-04-15
**Fase:** 26 — Estende Fase 24 pattern para products, tasks, workflows, campaigns, segments.

## Escopo

Pattern consolidado na Fase 24 (`docs/.../filters_bulk_pattern.md`):
- Server action `delete<Entity>Bulk(ids: string[])` com RBAC `<módulo>:delete` + tenant scope `deleteMany where companyId`.
- UI: `FilterBar` + `BulkActionBar` + checkboxes + AlertDialog confirm.
- URL filters via searchParams com `router.replace`.

Módulos-alvo (ordem de execução):

1. **Products** — filtros: q (name/sku), category, active (all/only-active/only-archived).
2. **Tasks (Activities)** — filtros: q (title), type (call/meeting/task/note/file), status (pending/done/etc), subjectType.
3. **Workflows** — filtros: q (name), status (draft/active/paused), trigger.
4. **Campaigns** — filtros: q (name), status (draft/scheduled/running/completed/canceled).
5. **Segments** — filtros: q (name).

## Arquivos afetados (por módulo)

| Módulo | Actions | Page | Content |
|---|---|---|---|
| products | `src/lib/actions/products.ts` (+ deleteProductsBulk) | `src/app/(protected)/products/page.tsx` | `_components/products-content.tsx` (refactor se existir) |
| tasks | `src/lib/actions/activities.ts` (+ deleteActivitiesBulk) | `src/app/(protected)/tasks/page.tsx` | refactor |
| workflows | `src/lib/actions/workflows.ts` (+ deleteWorkflowsBulk) | `src/app/(protected)/automation/workflows/page.tsx` | refactor |
| campaigns | `src/lib/actions/campaigns.ts` (+ deleteCampaignsBulk) | `src/app/(protected)/marketing/campaigns/page.tsx` | refactor |
| segments | `src/lib/actions/segments.ts` (+ deleteSegmentsBulk) | `src/app/(protected)/marketing/segments/page.tsx` | refactor |

## Fora de escopo

- Bulk edit (Fase 28).
- Saved filters (Fase 27).
- Filtros complex em mailboxes/users/companies.

## Testes

- Unit: atualizar suites existentes se precisar.
- E2E: adicionar casos em `filters-bulk.spec.ts` ou novo `filters-bulk-extended.spec.ts` — no mínimo smoke para products.

## Riscos

- Workflows/Campaigns/Segments podem ter relações com outros modelos (ex: Campaign → CampaignRecipient). Usar `deleteMany` direto pode falhar se houver FK sem onDelete. Testar com seed.
- Activity tem relações (ActivityReminder?) — conferir schema e adicionar cascade/restrict explícito.
