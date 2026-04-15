# Spec v3 — Fase 28: Bulk Delete em Workflows + Tasks

## Escopo

- `deleteWorkflowsBulkAction(ids)`: RBAC `workflows:manage` + tenant + limite 500 + deleteMany (WorkflowExecution cascade OK via onDelete Cascade).
- `deleteActivitiesBulk(ids)`: RBAC `activities:delete` + tenant + limite 500. Cancela reminders (best-effort), deleta files no storage (best-effort), deleteMany com cascade nativa para ActivityFile/ActivityReminder.
- UI: checkbox col + BulkActionBar + AlertDialog em ambos.

## Completa sequência de 5 módulos

Fase 26 (products) + Fase 27 (segments + campaigns) + **Fase 28 (workflows + tasks)** = todos os módulos restantes cobertos.

## Tags

`phase-28-bulk-workflows-tasks-deployed`
