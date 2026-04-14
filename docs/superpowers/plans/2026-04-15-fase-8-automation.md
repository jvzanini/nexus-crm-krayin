# Fase 8 — Automation Engine MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Engine declarativa trigger→condition→action com 3 triggers + 4 actions; anti-storm (chainDepth+quota+circuit breaker); UI minimal block editor; idempotência via eventId.

**Architecture:** Workflow + WorkflowExecution models. Dispatcher busca workflows ativos por trigger; avalia conditions; enqueue BullMQ; processor executa actions sequenciais. Send-email action delega a `sendEmailAction` (Fase 7c — stub até lá).

**Spec:** `docs/superpowers/specs/2026-04-15-fase-8-automation-design.md`.

---

## Tasks

### T1 — Migration workflows + workflow_executions + enums
**Files:** schema.prisma, `prisma/migrations/20260422000000_automation/migration.sql` + down.sql.
- [ ] Adicionar 3 enums (`WorkflowTrigger`, `WorkflowStatus`, `ExecutionStatus`) + 2 models.
- [ ] SQL `CREATE TYPE` + tabelas + índices + FK.
- [ ] Commit `feat(crm): migration automation schema (Fase 8 T1)`.

### T2 — RBAC workflows:*
**Files:** `src/lib/rbac/permissions.ts`, test.
- [ ] 2 perms `workflows:view`, `workflows:manage`.
- [ ] Roles: admin/manager = manage; seller/viewer = view; super_admin = all via `[...PERMISSIONS]`.
- [ ] Commit `feat(crm): rbac workflows:* (Fase 8 T2)`.

### T3 — Condition evaluator (pure)
**Files:** `src/lib/automation/conditions.ts`, test.
- [ ] Operadores `eq|neq|in|gt|lt|contains`. Tipo union `Condition`. `evaluate(payload, conditions[]): boolean` com AND-of-conditions.
- [ ] Unit tests: 20+ cenários (op × tipo × edge null/undefined/array).
- [ ] Commit `feat(crm): automation condition evaluator (Fase 8 T3)`.

### T4 — Action executors
**Files:** `src/lib/automation/actions/*.ts`, tests.
- [ ] `update-field`: prisma update em `entityType` por `idField`. Valida tenant.
- [ ] `create-task`: chama `createActivity` action (tipo task, title, dueAt=now+hours, assignedTo).
- [ ] `assign-user`: update `assignedTo` em lead/contact/opportunity.
- [ ] `send-email` — **stub** em 8.0: retorna `{skipped: true, reason: "Fase 7c not deployed"}` quando sendEmailAction ausente; caso contrário delega.
- [ ] Interface unificada `ActionExecutor<Params>`.
- [ ] Commit `feat(crm): automation action executors (Fase 8 T4)`.

### T5 — Dispatcher + BullMQ queue
**Files:** `src/lib/automation/dispatcher.ts`, `src/lib/worker/queues/automation-execute.ts`, processor, tests.
- [ ] `dispatch(trigger, payload)`: busca workflows; eval conditions; upsert execution (unique workflowId+eventId); enqueue.
- [ ] Processor: load execution + workflow; executa actions seq; atualiza status + output.
- [ ] Anti-storm inline:
  - chainDepth check antes do enqueue (aborted_chain_depth).
  - quota INCR no Redis antes do enqueue (aborted_quota).
  - circuit breaker: a cada execution completed/failed, atualiza counter 1h sliding window; se >20 executions e fail_ratio > 0.5, paused + notification.
- [ ] Tests mock prisma + redis + queue.
- [ ] Commit `feat(crm): automation dispatcher + processor + anti-storm (Fase 8 T5)`.

### T6 — Emissores (hooks)
**Files:** `src/lib/actions/leads.ts`, `contacts.ts`, `activities.ts` — modify.
- [ ] Após cada `createLead` bem-sucedido, **pós-commit** da transaction, chama `dispatch('lead_created', {...})`.
- [ ] idem contact + completeActivity.
- [ ] Importante: dispatch nunca lança (fire-and-forget com log).
- [ ] Commit `feat(crm): automation emissores em leads/contacts/activities (Fase 8 T6)`.

### T7 — UI `/automation/workflows`
**Files:** `src/app/(protected)/automation/workflows/page.tsx` + `[id]/page.tsx` + `_components/*`.
- [ ] Lista workflows.
- [ ] Editor: trigger select, conditions blocks (add/remove), actions blocks (add/remove), status toggle.
- [ ] i18n pack `automation.json` br/us.
- [ ] Commit `feat(crm): /automation/workflows UI (Fase 8 T7)`.

### T8 — Memory + roadmap + tag
- [ ] Memory: `automation_engine.md`, `anti_storm_policy.md`.
- [ ] Roadmap 5 linhas parity.
- [ ] Tag `phase-8-deployed`.

---

## Ordem

T1 → T2 → T3 (paralelo possível após T1). T4 depende T1+T3. T5 depende T1+T3+T4. T6 depende T5. T7 depende T5. T8 final.

## Bloqueadores externos

- Trigger `opportunity.stage_changed` requer Fase 2 (pipelines) → Fase 8.1.
- Custom-attribute triggers requer Fase 5 → Fase 8.1.
- `send-email` action 100% funcional requer Fase 7c → em 8.0 fica stub.
