# Spec v3 — Fase 29: Bulk Edit Status em Leads

## Escopo

- `updateLeadsStatusBulk(ids, status)`: RBAC `leads:edit` + tenant + limite 500 + valida status contra allowlist `[new, contacted, qualified, unqualified, converted]`. Retorna `{updatedCount}`.
- `BulkActionBar` estendido com prop `editActions?: BulkEditOption[]` (novo botão "Mudar status" entre Cancelar e Excluir).
- Leads-content: Dialog bulk status com select + Aplicar button; invocado via `editActions` apenas quando `canEdit`.

## Fora de escopo

- Contacts/Opportunities bulk edit (fase subsequente 29b/29c).
- Saved filters.
- Bulk assign (trocar owner).

## Tags

`phase-29-bulk-edit-leads-deployed`
