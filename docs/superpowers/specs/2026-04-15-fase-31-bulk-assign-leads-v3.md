# Spec v3 — Fase 31: Bulk Assign Owner em Leads

## Escopo

- `assignLeadsBulk(ids, assigneeId | null)`: RBAC `leads:edit` + tenant + valida que `assigneeId` é membro ativo da company; null = desatribuir. Limite 500.
- `getCompanyAssignees()`: retorna usuários ativos da company para popular select.
- UI: terceiro botão "Atribuir a..." no `BulkActionBar.editActions` + Dialog com select de usuários (lazy-load).

## Tag

`phase-31-bulk-assign-leads-deployed`
