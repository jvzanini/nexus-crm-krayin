# Spec v3 — Fase 32: Bulk Assign Owner em Opportunities

## Escopo

- `assignOpportunitiesBulk(ids, assigneeId|null)`: replica pattern de Fase 31. RBAC `opportunities:edit` + tenant + valida membro ativo + limite 500.
- Reusa `getCompanyAssignees()` de leads.ts (tenant scoped, qualquer user com permissão de leads:view ou similar).
- UI: Dialog "Atribuir a..." em opportunities-content.

## Tag

`phase-32-bulk-assign-opportunities-deployed`
