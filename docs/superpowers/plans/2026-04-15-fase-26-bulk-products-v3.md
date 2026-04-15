# Plan v3 FINAL — Fase 26: Bulk Delete em Products

## Tasks executadas

1. **T1** — `deleteProductsBulk(ids)` em `src/lib/actions/products.ts`: RBAC `products:delete`, tenant scope `companyId`, limite 500, `deleteMany`.
2. **T2** — `products-content.tsx`: imports (`BulkActionBar`, `Checkbox`, `deleteProductsBulk`).
3. **T3** — State: `selectedIds`, `bulkDeleteDialogOpen`, `bulkDeleting`, handlers `toggleRow/toggleAll/confirmBulkDelete`.
4. **T4** — UI: `BulkActionBar` logo acima da Table; checkbox column head + row; `AlertDialog` bulk.
5. **T5** — Build prod verde.
6. **T6** — Commit + push + tag `phase-26-bulk-products-deployed`.

## Critérios de sucesso

- [x] Build clean.
- [x] TS sem erros novos.
- [ ] Smoke prod `/products` carrega.
- [ ] Tag aplicada.

## Follow-ups

- Fase 26b: URL sync filtros em products (opcional).
- Fase 27: bulk delete segments + campaigns.
- Fase 28: bulk delete workflows + tasks.
