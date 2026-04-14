# Spec: Fase 6 — Activities (Calls, Meetings, Tasks, Notes, Files) + Reminders

**Data:** 2026-04-15
**Versão:** v3 (inline 2 reviews)
**Depende de:** Fase 1b (consent) ✅, Fase 1c (RBAC, flags, logger, health) ✅.
**Gate para:** Fase 7 (Email integration usa activities como timeline), Fase 8 (Automation dispara em `activity.completed`).

---

## Changelog

### v2 → v3 (Review 2 profunda)
- **Timezone storage:** `Meeting.scheduledAt` em UTC (timestamptz). `Meeting.timezone` (IANA, VarChar(64)) guardado separado para reconstruir o horário local do criador para os participantes. Cálculo de "hoje/amanhã" nas listas usa `user.timezone` (já existe em session).
- **File storage:** abstraído via interface `FileStorageDriver` com duas impls iniciais: `LocalDiskDriver` (`/var/lib/nexus-crm/files/...`) e `S3Driver`. Seleção via env `FILE_STORAGE_DRIVER=local|s3`. MVP de Fase 6 entrega apenas `LocalDiskDriver`; `S3Driver` vai na Fase 12 junto com backup.
- **Polimorfismo de "assunto":** Activity tem `subjectType ENUM('lead','contact','opportunity')` + `subjectId UUID`. FK condicional não é suportada por Postgres/Prisma direto; validação no server action antes de insert (`prisma.lead/contact/opportunity.findUnique({companyId, id})`). Index composto `(subjectType, subjectId, scheduledAt DESC)` cobre timeline de cada assunto.
- **Reminders:** BullMQ job scheduled para `reminderAt` (nullable). Ao completar/cancelar, cancelar job via `job.remove()`. Durability: re-enfileirar pendentes no worker boot (`findMany({ where: { reminderAt: { gt: now }, status: 'pending' } })`).
- **File scanning:** fora de escopo 1c; MVP valida mime (allowlist) + size (<= 25MB). Antivírus/clamav vai para Fase 12.
- **Tasks vs Calls/Meetings:** unificadas no mesmo model `Activity` com `type ENUM('call','meeting','task','note','file')`. Cada tipo tem campos típicos opcionais; a UI renderiza form específico por tipo. Motivo: timeline única por subject é requisito de produto.
- **`consent_tracking`** dos assuntos **não** restringe criação de activity — restringe apenas envio de email (Fase 7). Activity pode ser logada sem consent (ex.: ligação recebida).

### v1 → v2 (Review 1 ampla)
- Separado `File` como sub-model referenciado por Activity via `attachments[]` (1-N). Permite múltiplos anexos por activity.
- Adicionado estados explícitos: `status ENUM('pending','completed','canceled')`. Útil para filtragem de pipeline (ex.: "minhas tasks abertas").
- RBAC: permissions `activities:view|create|edit|delete` + `activities:complete` (para fechar task sem ter edit amplo).

---

## 1. Objetivo

1. Timeline unificada por Lead/Contact/Opportunity com **Calls, Meetings (timezone-aware), Tasks, Notes, Files**.
2. Reminders scheduled via BullMQ, com notificação in-app (e email opcional na Fase 7).
3. Storage abstraído para files (local agora, S3 em Fase 12).

## 2. Escopo

### 2.1. Schema

```prisma
enum ActivityType {
  call
  meeting
  task
  note
  file
}

enum ActivityStatus {
  pending
  completed
  canceled
}

enum ActivitySubjectType {
  lead
  contact
  opportunity
}

model Activity {
  id           String              @id @default(uuid()) @db.Uuid
  companyId    String              @map("company_id") @db.Uuid
  type         ActivityType
  status       ActivityStatus      @default(pending)

  subjectType  ActivitySubjectType @map("subject_type")
  subjectId    String              @map("subject_id") @db.Uuid

  title        String
  description  String?

  // Call/Meeting/Task
  scheduledAt  DateTime?           @map("scheduled_at")  // UTC
  timezone     String?             @db.VarChar(64)        // IANA (meeting only)
  durationMin  Int?                @map("duration_min")
  location     String?             // url ou endereço (meeting)

  // Task
  dueAt        DateTime?           @map("due_at")
  completedAt  DateTime?           @map("completed_at")

  // Reminder
  reminderAt   DateTime?           @map("reminder_at")   // UTC
  reminderJobId String?            @map("reminder_job_id") // BullMQ

  // Common
  assignedTo   String?             @map("assigned_to") @db.Uuid
  createdBy    String              @map("created_by") @db.Uuid
  createdAt    DateTime            @default(now()) @map("created_at")
  updatedAt    DateTime            @updatedAt @map("updated_at")

  files        ActivityFile[]

  @@index([companyId, subjectType, subjectId, scheduledAt(sort: Desc)], name: "idx_activity_timeline")
  @@index([companyId, assignedTo, status, dueAt], name: "idx_activity_mytasks")
  @@index([reminderAt], name: "idx_activity_reminder_due")
  @@map("activities")
}

model ActivityFile {
  id          String   @id @default(uuid()) @db.Uuid
  activityId  String   @map("activity_id") @db.Uuid
  storageKey  String   @map("storage_key")      // ex: "companies/<uuid>/files/<uuid>.bin"
  filename    String
  mimeType    String   @map("mime_type") @db.VarChar(128)
  size        Int
  createdAt   DateTime @default(now()) @map("created_at")
  createdBy   String   @map("created_by") @db.Uuid

  activity Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@index([activityId], name: "idx_activity_file_by_activity")
  @@map("activity_files")
}
```

### 2.2. RBAC

Adicionar em `src/lib/rbac/permissions.ts`:

```
"activities:view",
"activities:create",
"activities:edit",
"activities:delete",
"activities:complete",
```

Distribuição:
- super_admin, admin: tudo.
- manager: tudo.
- seller: create/edit/complete/view; NÃO delete.
- viewer: view apenas.

### 2.3. Server Actions

`src/lib/actions/activities.ts`:

- `listActivitiesForSubject(subjectType, subjectId, filter?: { type?, status? })` → timeline ordenada `scheduledAt DESC NULLS LAST, createdAt DESC`.
- `listMyTasks(filter?: { status?, dueWithinDays? })` → tasks assigned to me.
- `getActivity(id)`.
- `createActivity(input)` — valida subject existe no tenant; cria activity + (opcional) arquivo(s); enfileira reminder se `reminderAt`.
- `updateActivity(id, patch)` — re-agenda reminder se `reminderAt` mudou.
- `completeActivity(id)` — `status='completed', completedAt=now`, cancela reminder job.
- `cancelActivity(id)` — `status='canceled'`, cancela reminder.
- `deleteActivity(id)` — hard delete (Cascade remove files).
- `uploadFile(activityId, {filename, mime, bytes})` — grava via `FileStorageDriver`, cria ActivityFile. Valida mime allowlist + size.
- `downloadFile(fileId)` — retorna stream via driver.

Todas com `requirePermission` + tenant scope.

### 2.4. File storage driver

`src/lib/files/driver.ts`:

```ts
export interface FileStorageDriver {
  put(key: string, bytes: Buffer, mime: string): Promise<{ key: string }>;
  get(key: string): Promise<{ stream: NodeJS.ReadableStream; size: number; mime: string }>;
  delete(key: string): Promise<void>;
}
```

`src/lib/files/local.ts` — `LocalDiskDriver` root `/var/lib/nexus-crm/files` (ou `process.env.FILE_STORAGE_ROOT`). Cria dir se não existe. Fallback dev: `./.storage/files` (gitignored).

`src/lib/files/index.ts` — factory que escolhe driver via `FILE_STORAGE_DRIVER` env (`local` default). `S3Driver` a partir de Fase 12.

Mime allowlist em `src/lib/files/allowlist.ts`: imagens (png/jpg/webp/gif), docs (pdf, docx, xlsx, csv, txt), audio (mp3, wav, ogg). Max size 25MB (configurável via `FILE_MAX_SIZE_MB`).

### 2.5. BullMQ reminders

`src/lib/worker/queues/activity-reminders.ts`:
- Queue `activity-reminders`.
- Job name `reminder`, payload `{ activityId, userId, subjectType, subjectId, title }`.
- `scheduleReminder(activity)` → `queue.add('reminder', payload, { delay: computeDelay(activity.reminderAt) })`.
- `cancelReminder(jobId)` → `queue.getJob(jobId).remove()` (null-safe).
- Worker (`src/lib/worker/processors/activity-reminder.ts`): carrega activity, se ainda `pending`, cria `Notification` para `assignedTo || createdBy` via módulo notifications existente.
- Boot do worker (`src/lib/worker/index.ts`): on startup, `findMany` activities com `reminderAt > now()` e `status='pending'` que não tem jobs no queue — re-enfileira.

### 2.6. UI

- **Timeline por subject** (em `/leads/[id]`, `/contacts/[id]`, `/opportunities/[id]`): componente `<ActivityTimeline subjectType subjectId />`. MVP vive em uma nova aba na página de detalhe; como essas telas não têm ainda rotas detalhe, criar subpáginas simples:
  - `/leads/[id]/activities/page.tsx` (e idem para contacts, opportunities).
- **`/tasks` (meus)** — lista global com filtro status/dueWithinDays.
- **Form modal por tipo** — campos diferentes:
  - call: title, scheduledAt, durationMin, assignedTo, notes.
  - meeting: title, scheduledAt + timezone, durationMin, location (url/endereço), assignedTo.
  - task: title, description, dueAt, assignedTo, reminderAt.
  - note: title, description rich (textarea simples em MVP; Fase 1d entrega RichTextEditor).
  - file: filename, drop zone upload (1 arquivo por form; múltiplos via upload sequencial).

### 2.7. i18n

Pack `activities.json` em br/us com chaves `list`, `timeline`, `form.{call,meeting,task,note,file}`, `action`, `reminder`.

### 2.8. Fora de escopo

- Integração calendário (Google/Outlook) — Fase 7.
- Recurring tasks/meetings.
- RichTextEditor para notes (Fase 1d).
- Antivírus scanning de uploads (Fase 12).
- S3 storage driver (Fase 12).
- Email reminder (Fase 7).
- Bulk upload / drag-drop múltiplos.

## 3. Testes

### 3.1. Unit
- `computeDelay(reminderAt)` — now vs future vs past.
- `scheduleReminder`/`cancelReminder` — mock queue.
- mime allowlist + size guards.
- timezone: format "America/Sao_Paulo" scheduledAt UTC → local string correta.

### 3.2. Integração
- `createActivity` cria row + reminder job; mock BullMQ.
- `completeActivity` cancela job.
- `deleteActivity` cascade remove files (em driver local, file físico deletado).

### 3.3. E2E
- Seller cria task, reminder agendado.
- Worker processa reminder → notification criada.
- Seller não consegue delete (RBAC block).

## 4. Riscos

| Risco | Sev | Mitigação |
|-------|-----|-----------|
| Job órfão se worker cai antes de re-enfileiramento | Alto | Boot do worker scan e re-enqueue; idempotência via activityId check no handler. |
| Upload grande estoura memória | Alto | Stream upload (Node Readable) + limit 25MB rejeitado no reverse proxy (Caddy) antes de chegar no app. |
| File driver trocando em runtime | Médio | Driver resolvido no boot, imutável durante process life. |
| Timezone IANA inválida | Médio | Allowlist via `Intl.supportedValuesOf('timeZone')` em runtime; reject se fora. |
| FK cross-tenant via subjectId forjado | Alto | Server action valida `subject.companyId === session.companyId` antes de insert. |
| Deletar activity com file em storage mas falha mid-way | Médio | Transação: DB delete + file delete. Se file delete falha, log e não rollback DB (file fica orfão; cleanup job em Fase 12). |
| Reminder em timezone diferente do usuário | Médio | `reminderAt` sempre UTC; UI lê e converte via `user.timezone`. |

## 5. Aceite

- Migration + permissions atualizadas.
- `/tasks` lista + `/leads/[id]/activities` timeline funcionais.
- Reminder BullMQ end-to-end (worker boot + job + notification).
- Upload local funcional.
- RBAC: seller não deleta.
- 15+ unit tests novos.
- 3+ memory files (activity pattern, file storage driver, reminder pipeline).

## 6. Rollback

`git revert` + migration down. Files em disco ficam (cleanup manual). BullMQ queue drain manual.

## 7. Convenção de commits

- `feat(crm): migration activities + activity_files + enums` (T1)
- `feat(crm): rbac activities:* + lib file driver local` (T2+T3)
- `feat(crm): server actions activities (CRUD + reminders + upload)` (T4)
- `feat(crm): BullMQ queue activity-reminders + worker processor` (T5)
- `feat(crm): UI /tasks + timeline em /leads|/contacts|/opportunities/[id]/activities` (T6)
- `feat(crm): i18n activities br/us` (T7)
- `chore(crm): release fase 6 (tag phase-6-deployed)` (final)

## 8. Dependências

- `bullmq` (já em deps ^5.73).
- `ioredis` (já em deps).
- `mime-types` para content-type detection no driver (adicionar se ausente).
