# Spec: Fase 8 — Automation Workflows (MVP)

**Data:** 2026-04-15
**Versão:** v3 (inline 2 reviews)
**Depende de:** Fase 2 (pipelines — bloqueada em 1d), Fase 5 (custom attrs — bloqueada em 1d), Fase 6 (activities) ✅, Fase 7 (email) parcial.
**Gate para:** Fase 9 (marketing usa workflows), Fase 11 (reports de automação).

---

## Changelog

### v2 → v3 (Review 2)
- **Dividido em 8.0 (engine core) e 8.1 (triggers reais):**
  - **8.0** — schema workflow/execution + engine dispatcher + ações genéricas (send-email, update-field, create-task, assign-user) + anti-storm básico (counter por event-chain). Ignora triggers que dependem de Fase 2/5 (pipeline.stage_changed). Triggers disponíveis: `lead.created`, `contact.created`, `activity.completed`.
  - **8.1** — `opportunity.stage_changed` (requer Fase 2) e custom-attribute triggers (Fase 5).
- **Idempotência:** cada execution referencia `eventId` único; workflow+eventId é unique → retries seguros.
- **Loop guard:** execution carrega `chainDepth` (quantos workflows já dispararam desta cadeia). Abort em `chainDepth >= 10`. Contador zerado quando trigger é externo (webhook/UI).
- **Quota per tenant per day:** setting `automationDailyQuota` (default 10000) em `GlobalSettings`. Execution incrementa counter Redis `automation:quota:<tenantId>:<YYYYMMDD>`. Excedeu → enqueue com prioridade baixa + notifica admin.
- **Circuit breaker:** se >50% das executions de um workflow falham em 1h, auto-desativa workflow e notifica owner.

### v1 → v2 (Review 1)
- Actions em blocks declarativos — não scripts dinâmicos. Evita eval / injection.
- Workflow model tem `isActive` bool + versão (não edit sobrescreve; cria nova versão).

---

## 1. Objetivo

Permitir configurar automações declarativas: **quando X acontece, verifique Y, execute Z** — sem código. MVP cobre 3 triggers + 4 actions. Expansão em 8.1.

## 2. Escopo

### 2.1. Schema (8.0)

```prisma
enum WorkflowTrigger {
  lead_created
  contact_created
  activity_completed
}

enum WorkflowStatus {
  draft
  active
  paused
}

enum ExecutionStatus {
  pending
  running
  completed
  failed
  aborted_chain_depth
  aborted_quota
}

model Workflow {
  id          String          @id @default(uuid()) @db.Uuid
  companyId   String          @map("company_id") @db.Uuid
  name        String
  description String?
  trigger     WorkflowTrigger
  conditions  Json            // [{field, op, value}]
  actions     Json            // [{type, params}]
  status      WorkflowStatus  @default(draft)
  version     Int             @default(1)
  lastEditBy  String?         @map("last_edit_by") @db.Uuid
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")

  executions WorkflowExecution[]

  @@index([companyId, status, trigger], name: "idx_workflow_dispatch")
  @@map("workflows")
}

model WorkflowExecution {
  id          String          @id @default(uuid()) @db.Uuid
  workflowId  String          @map("workflow_id") @db.Uuid
  companyId   String          @map("company_id") @db.Uuid
  eventId     String          @map("event_id")        // idempotency key
  chainDepth  Int             @default(0) @map("chain_depth")
  status      ExecutionStatus @default(pending)
  input       Json
  output      Json?
  errorMessage String?        @map("error_message")
  startedAt   DateTime?       @map("started_at")
  finishedAt  DateTime?       @map("finished_at")

  workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  @@unique([workflowId, eventId], name: "uq_execution_workflow_event")
  @@index([companyId, status, startedAt(sort: Desc)], name: "idx_execution_recent")
  @@map("workflow_executions")
}
```

### 2.2. Condições (JSON schema)

```ts
type Condition = {
  field: string;       // ex.: "status" em lead.created payload
  op: "eq" | "neq" | "in" | "gt" | "lt" | "contains";
  value: unknown;
};
```

Evaluator em `src/lib/automation/conditions.ts` — funções puras, zero I/O.

### 2.3. Actions (JSON schema)

```ts
type Action =
  | { type: "send-email";   params: { mailboxId: string; subject: string; bodyHtml: string; toField: string; } }
  | { type: "update-field"; params: { entityType: "lead"|"contact"|"opportunity"; idField: string; field: string; value: unknown; } }
  | { type: "create-task";  params: { title: string; assignedTo?: string; dueInHours?: number; } }
  | { type: "assign-user";  params: { entityType: "lead"|"contact"|"opportunity"; idField: string; userId: string; } };
```

Executor em `src/lib/automation/actions.ts` — cada action é uma função async com contrato `(params, context) => Promise<Record<string, unknown>>`.

### 2.4. Dispatcher

`src/lib/automation/dispatcher.ts`:
- `dispatch(trigger: WorkflowTrigger, payload: {tenantId, eventId, chainDepth?, ...data})`.
- Busca workflows ativos para `(tenantId, trigger)`.
- Para cada: valida conditions; cria WorkflowExecution; enfileira job BullMQ `automation-execute`.
- Processor: carrega execution, executa actions sequenciais. Update status.

### 2.5. Emissores

Hooks nos server actions existentes:
- `createLead` → `dispatch('lead_created', {eventId, leadId, ...})`.
- `createContact` → `dispatch('contact_created', ...)`.
- `completeActivity` → `dispatch('activity_completed', ...)`.

Cada chamada gera `eventId = uuid()` garantindo idempotência.

### 2.6. RBAC

Novas permissions:
- `workflows:view`, `workflows:manage` — admin/manager.

### 2.7. UI (8.0 — block builder simples)

`/automation/workflows` — lista.
`/automation/workflows/[id]` — editor:
- Seção Trigger (select).
- Seção Conditions — adicionar N blocks `{field, op, value}` via forms.
- Seção Actions — dropdown tipo + params.
- Status toggle.

Fase 8.1 pode migrar para visual flow builder.

### 2.8. Anti-storm concreto

- Loop: execution nova herda `chainDepth = parentExecution.chainDepth + 1`. Se >= 10, aborta.
- Quota: BEFORE enqueue, `INCR automation:quota:<tenant>:<date>`; se `> dailyQuota`, marca `aborted_quota` e continua (não enfileira job). Admin notificação uma vez por dia.
- Circuit breaker: query últimas 1h de execution por workflow; se fail ratio > 50% em >= 20 executions, set `status=paused`, cria Notification.

### 2.9. Fora de escopo

- Triggers pipeline/opportunity/custom-attr — Fase 8.1.
- Multi-step branching — Fase 8.2.
- Rollback de actions — aceita que falha parcial permanece (log para investigação).
- Scheduled/delayed actions — Fase 8.1.

## 3. Testes

- Unit conditions evaluator: 50+ casos (combinações op × tipo de field).
- Unit action executors: mock dependencies (prisma, email send).
- Integration dispatcher: idempotent (retry com mesmo eventId não duplica execution).
- E2E: criar workflow "lead.created + status=new" → action "create-task" → gera Activity.

## 4. Riscos

| Risco | Sev | Mitigação |
|-------|-----|-----------|
| Loop infinito entre workflows | Muito alto | chainDepth + abort. |
| Quota explosion (script malicioso) | Alto | Daily quota por tenant com notification. |
| Action falha parcial (update ok, email fail) | Médio | Status `failed` + error message preservado; admin investiga. |
| Workflow desativado mas jobs na fila | Médio | Processor checa `workflow.status === 'active'` antes de executar. |
| Eventos Prisma não atômicos com dispatch | Médio | Pattern "outbox dispatch post-commit" — dispatch **após** transaction success, nunca dentro. |

## 5. Aceite (8.0)

- Schema + 3 triggers + 4 actions funcionais.
- chainDepth + quota + circuit breaker implementados.
- UI minimal block editor renderiza.
- E2E 1 workflow criado e disparado.
- 50+ unit tests.

## 6. Convenção commits

- `feat(crm): migration workflows + workflow_executions (Fase 8 T1)`
- `feat(crm): condition evaluator (Fase 8 T2)`
- `feat(crm): action executors + dispatcher (Fase 8 T3)`
- `feat(crm): wire emissores (createLead/createContact/completeActivity) (Fase 8 T4)`
- `feat(crm): UI /automation/workflows (Fase 8 T5)`
- `feat(crm): anti-storm chainDepth + quota + circuit breaker (Fase 8 T6)`

## 7. Dependências

- Existing: prisma, bullmq, zod.
- Nenhuma nova.
