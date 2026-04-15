# Spec v3 — Fase 30: Bulk Status Change em Tasks

## Escopo

- `updateActivitiesStatusBulk(ids, status: "completed" | "canceled")`: RBAC `activities:edit`, tenant scope, allowlist enum, limite 500. Filtra apenas atividades `pending` (não toca em já concluídas/canceladas). Cancela `reminderJobId` antes de update. Set `completedAt = now()` quando completed.
- BulkActionBar gated por `canComplete`: dois botões "Concluir" e "Cancelar" via `editActions`.
- UI tasks-content: `bulkChangeStatus(status)` invoca a action e recarrega.

## Tag

`phase-30-bulk-status-tasks-deployed`
