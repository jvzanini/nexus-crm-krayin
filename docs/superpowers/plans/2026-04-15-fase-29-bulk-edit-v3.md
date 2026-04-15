# Plan v3 — Fase 29: Bulk Edit Status em Leads + Stage em Opportunities

## Tasks executadas

- T1: `updateLeadsStatusBulk(ids, status)` em `src/lib/actions/leads.ts`
- T2: `updateOpportunitiesStageBulk(ids, stage)` em `src/lib/actions/opportunities.ts`
- T3: Estender `BulkActionBar` com prop `editActions?: BulkEditOption[]` (novo botão)
- T4: leads-content — Dialog bulk status + edit action em BulkActionBar
- T5: opportunities-content — Dialog bulk stage + edit action
- T6: Build prod verde
- T7: Commit + push + tag `phase-29-bulk-edit-deployed`

## Critérios

- [x] Build clean
- [ ] Viewer sem edit permission → botão "Mudar status/stage" escondido
- [ ] Invalid status/stage → 400
- [ ] updateMany tenant-scoped via companyId

## Follow-ups

- Fase 30: Bulk assign owner (trocar assignedTo).
- Fase 31: Saved Filters.
- Fase 32: Quotes (Fase 4).
