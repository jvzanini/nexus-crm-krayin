# Fase 6 — Activities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recomendado). Steps usam checkbox para tracking.

**Goal:** Entregar timeline de activities (Calls, Meetings timezone-aware, Tasks, Notes, Files) por Lead/Contact/Opportunity + reminders via BullMQ.

**Architecture:** model único `Activity` polimórfico (subjectType/subjectId) + 1-N `ActivityFile` via driver `FileStorageDriver` (local default, S3 Fase 12) + queue BullMQ `activity-reminders` com re-enqueue no boot do worker.

**Tech Stack:** Prisma v7, Next 16 App Router, BullMQ 5, Sonner toasts, DS v0.3.0, next-intl.

**Spec:** `docs/superpowers/specs/2026-04-15-fase-6-activities-design.md`.

---

## Changelog

### v2 → v3 (Review 2 profunda inline)
- **T1 migration** inclui enums no arquivo SQL (Postgres DDL CREATE TYPE) + rollback via DROP TYPE no down.sql.
- **T5 (worker)** ganha teste de boot: mock Redis, mock `prisma.activity.findMany`, confirma re-enqueue.
- **T6 (UI)** dividida em T6a (componente `<ActivityTimeline>` + form modal) + T6b (páginas /tasks, /leads/[id]/activities, /contacts/[id]/activities, /opportunities/[id]/activities). Reduz escopo de PR.
- **T4 (actions)** inclui validação de timezone IANA via `Intl.supportedValuesOf('timeZone').includes(tz)`.
- **T3 (file driver)** começa com `LocalDiskDriver`. Teste: put → get → delete sobre tmpdir. Interface testada via fake. S3Driver stub vai com TODO explícito.

### v1 → v2 (Review 1 ampla inline)
- Introduzido `T0` prerequisito: adicionar permissions `activities:*` em RBAC + test. Sem isso, server actions falham antes de tudo.
- Separadas tasks por sub-módulo (driver, queue, worker) para independência de reviewers.

---

## File Structure

**Create:**
- `prisma/migrations/20260418000000_activities/migration.sql` + `down.sql`
- `src/lib/files/driver.ts` (interface)
- `src/lib/files/local.ts` (LocalDiskDriver)
- `src/lib/files/allowlist.ts` (mime + size)
- `src/lib/files/index.ts` (factory)
- `src/lib/files/*.test.ts`
- `src/lib/worker/queues/activity-reminders.ts`
- `src/lib/worker/processors/activity-reminder.ts`
- `src/lib/worker/boot.ts` (re-enqueue pending)
- `src/lib/worker/*.test.ts` (mocked)
- `src/lib/actions/activities.ts` + `.test.ts`
- `src/components/activity/activity-timeline.tsx`
- `src/components/activity/activity-form.tsx`
- `src/app/(protected)/tasks/page.tsx` + `_components/tasks-content.tsx`
- `src/app/(protected)/leads/[id]/activities/page.tsx` (+ contacts, opportunities)
- `src/locale/packs/{br,us}/messages/activities.json`

**Modify:**
- `prisma/schema.prisma` — add `Activity`, `ActivityFile`, 3 enums.
- `src/lib/rbac/permissions.ts` — add `activities:*`.
- `src/lib/rbac/rbac.test.ts` — cover new perms per role.
- `src/lib/locale/messages.ts` — load activities pack in both locales.
- `package.json` — add `mime-types` if missing.

---

## Tasks

### Task 0 — Pré-requisitos RBAC

**Files:**
- Modify: `src/lib/rbac/permissions.ts`
- Modify: `src/lib/rbac/rbac.test.ts`

- [ ] **Step 1: Add `activities:*` permissions**

Em `PERMISSIONS` append:
```ts
"activities:view",
"activities:create",
"activities:edit",
"activities:delete",
"activities:complete",
```

Em `allOf` ampliar union para `"activities"` e usar `...allOf("activities")` nos roles super_admin, admin, manager. Seller ganha lista específica:
```ts
"activities:view","activities:create","activities:edit","activities:complete",
```
(seller **não** tem `activities:delete`.)
Viewer: `"activities:view"`.

- [ ] **Step 2: Atualizar rbac.test.ts**

Adicionar casos: manager tem `activities:delete`; seller **não** tem `activities:delete` mas tem `activities:complete`; viewer tem só `activities:view`.

- [ ] **Step 3: Run tests**

`npx vitest run src/lib/rbac --environment=node`  → all passing.

- [ ] **Step 4: Commit**

`feat(crm): rbac activities:* (Fase 6 T0)`.

---

### Task 1 — Migration + Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260418000000_activities/migration.sql`
- Create: `prisma/migrations/20260418000000_activities/down.sql`

- [ ] **Step 1: Adicionar 3 enums + 2 models em `schema.prisma`**

Use exatamente o bloco da spec §2.1.

- [ ] **Step 2: `npx prisma validate` → valid.**

- [ ] **Step 3: Criar `migration.sql`**

```sql
BEGIN;

CREATE TYPE "ActivityType" AS ENUM ('call','meeting','task','note','file');
CREATE TYPE "ActivityStatus" AS ENUM ('pending','completed','canceled');
CREATE TYPE "ActivitySubjectType" AS ENUM ('lead','contact','opportunity');

CREATE TABLE "activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "type" "ActivityType" NOT NULL,
  "status" "ActivityStatus" NOT NULL DEFAULT 'pending',
  "subject_type" "ActivitySubjectType" NOT NULL,
  "subject_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "scheduled_at" TIMESTAMP(3),
  "timezone" VARCHAR(64),
  "duration_min" INTEGER,
  "location" TEXT,
  "due_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "reminder_at" TIMESTAMP(3),
  "reminder_job_id" TEXT,
  "assigned_to" UUID,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_activity_timeline"
  ON "activities" ("company_id","subject_type","subject_id","scheduled_at" DESC);

CREATE INDEX "idx_activity_mytasks"
  ON "activities" ("company_id","assigned_to","status","due_at");

CREATE INDEX "idx_activity_reminder_due"
  ON "activities" ("reminder_at");

CREATE TABLE "activity_files" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "activity_id" UUID NOT NULL,
  "storage_key" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime_type" VARCHAR(128) NOT NULL,
  "size" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID NOT NULL,
  CONSTRAINT "activity_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_activity_file_by_activity" ON "activity_files" ("activity_id");

ALTER TABLE "activity_files"
  ADD CONSTRAINT "activity_files_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
```

- [ ] **Step 4: Criar `down.sql`**

```sql
BEGIN;
DROP TABLE "activity_files";
DROP TABLE "activities";
DROP TYPE "ActivitySubjectType";
DROP TYPE "ActivityStatus";
DROP TYPE "ActivityType";
COMMIT;
```

- [ ] **Step 5: `npx prisma generate` + commit**

`feat(crm): migration activities + activity_files + enums (Fase 6 T1)`.

---

### Task 2 — Mime allowlist + size guard

**Files:**
- Create: `src/lib/files/allowlist.ts`
- Create: `src/lib/files/allowlist.test.ts`

- [ ] **Step 1: Write failing test**

Test cobre: `isAllowedMime("application/pdf")` true; `image/bmp` false; `enforceSizeBytes(24 * 1024 * 1024)` ok; `26 * 1024 * 1024` lança `FileTooLargeError`.

- [ ] **Step 2: Implement**

```ts
export const ALLOWED_MIMES = new Set([
  "image/png","image/jpeg","image/webp","image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv","text/plain",
  "audio/mpeg","audio/wav","audio/ogg",
]);
export function isAllowedMime(m: string) { return ALLOWED_MIMES.has(m); }
export const DEFAULT_MAX_SIZE_MB = 25;
export class FileTooLargeError extends Error { constructor(public bytes: number) { super(`FILE_TOO_LARGE:${bytes}`); } }
export function enforceSize(bytes: number, maxMb = DEFAULT_MAX_SIZE_MB) {
  if (bytes > maxMb * 1024 * 1024) throw new FileTooLargeError(bytes);
}
```

- [ ] **Step 3: Run tests** → passing.

- [ ] **Step 4: Commit** `feat(crm): files allowlist + size guard (Fase 6 T2)`.

---

### Task 3 — File storage driver (local)

**Files:**
- Create: `src/lib/files/driver.ts` (interface)
- Create: `src/lib/files/local.ts`
- Create: `src/lib/files/index.ts` (factory)
- Create: `src/lib/files/local.test.ts`

- [ ] **Step 1: Write failing test** (local driver put/get/delete sobre tmpdir)

Usa `fs.mkdtemp` em beforeEach. Test: put returns key; get stream iguala bytes; delete remove arquivo físico.

- [ ] **Step 2: Implement**

`FileStorageDriver` interface com 3 métodos (`put/get/delete`) — spec §2.4.
`LocalDiskDriver`:
- Constructor recebe `root` (default `FILE_STORAGE_ROOT` ou `./.storage/files`).
- `put(key, buf, mime)`: mkdir recursive + `fs.writeFile(path.join(root,key), buf)`. Retorna `{key}`.
- `get(key)`: `fs.createReadStream(path.join(root,key))`. Size via stat.
- `delete(key)`: `fs.unlink(path.join(root,key))`. Silencia ENOENT.

`index.ts`:
```ts
export function getFileDriver(): FileStorageDriver {
  const d = process.env.FILE_STORAGE_DRIVER ?? "local";
  if (d === "local") return new LocalDiskDriver();
  throw new Error(`Unknown FILE_STORAGE_DRIVER: ${d}`);
}
```

- [ ] **Step 3: Run tests** → passing.

- [ ] **Step 4: Commit** `feat(crm): FileStorageDriver + LocalDiskDriver (Fase 6 T3)`.

---

### Task 4 — Server actions activities

**Files:**
- Create: `src/lib/actions/activities.ts`
- Create: `src/lib/actions/activities.test.ts`

- [ ] **Step 1: Write failing tests (pure validation)**

Tests cobrem zod schema: title obrigatório, type válido, timezone em `Intl.supportedValuesOf('timeZone')`, reminderAt > now quando presente, file mime na allowlist.

- [ ] **Step 2: Implement actions**

Padrão igual a `products.ts`:
- `"use server"` no topo.
- Cada action: `requirePermission("activities:<op>")`, resolver `companyId` via `UserCompanyMembership`, zod validação, Prisma op.
- `listActivitiesForSubject`, `listMyTasks`, `getActivity`, `createActivity`, `updateActivity`, `completeActivity`, `cancelActivity`, `deleteActivity`, `uploadFile`, `downloadFile`.
- `createActivity` e `updateActivity` chamam `scheduleReminder`/`cancelReminder` da queue lib.
- Subject validation: `prisma[subjectType].findUnique({ where: { id: subjectId } })` e comparar `.companyId`.
- `PermissionDeniedError` → retorna `{success:false,error:message}`.
- Logger + revalidatePath paths relevantes.

- [ ] **Step 3: Run tests** → passing.

- [ ] **Step 4: Commit** `feat(crm): server actions activities (Fase 6 T4)`.

---

### Task 5 — Queue BullMQ + Worker

**Files:**
- Create: `src/lib/worker/queues/activity-reminders.ts`
- Create: `src/lib/worker/processors/activity-reminder.ts`
- Create: `src/lib/worker/boot.ts`
- Create: `src/lib/worker/activity-reminders.test.ts`
- Modify: `src/lib/worker/index.ts` (boot chama reenqueue)

- [ ] **Step 1: queue lib**

```ts
import { Queue } from "bullmq";
import { redis } from "@/lib/redis";
export const ACTIVITY_REMINDERS = "activity-reminders";
export const activityReminderQueue = new Queue(ACTIVITY_REMINDERS, { connection: redis });

export async function scheduleReminder(activity: {id:string; reminderAt:Date; assignedTo:string|null; createdBy:string; subjectType:string; subjectId:string; title:string;}) {
  const delay = Math.max(0, activity.reminderAt.getTime() - Date.now());
  const job = await activityReminderQueue.add("reminder", {
    activityId: activity.id,
    userId: activity.assignedTo ?? activity.createdBy,
    subjectType: activity.subjectType,
    subjectId: activity.subjectId,
    title: activity.title,
  }, { delay, removeOnComplete: true, removeOnFail: 1000 });
  return job.id!;
}
export async function cancelReminder(jobId: string | null | undefined) {
  if (!jobId) return;
  const job = await activityReminderQueue.getJob(jobId);
  if (job) await job.remove();
}
```

- [ ] **Step 2: processor**

```ts
import { Worker } from "bullmq";
import { ACTIVITY_REMINDERS } from "../queues/activity-reminders";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";

export function startActivityReminderWorker() {
  return new Worker(ACTIVITY_REMINDERS, async (job) => {
    const { activityId, userId, title } = job.data;
    const a = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!a || a.status !== "pending") return;
    await createNotification({ userId, type: "activity_reminder", title: `Lembrete: ${title}`, data: { activityId } });
    logger.info({ activityId, userId }, "reminder.delivered");
  }, { connection: redis });
}
```

- [ ] **Step 3: boot re-enqueue**

```ts
export async function reenqueuePendingReminders() {
  const pending = await prisma.activity.findMany({
    where: { status: "pending", reminderAt: { gt: new Date() } },
    select: { id:true, reminderAt:true, reminderJobId:true, assignedTo:true, createdBy:true, subjectType:true, subjectId:true, title:true },
  });
  let scheduled = 0;
  for (const a of pending) {
    if (a.reminderJobId) {
      const existing = await activityReminderQueue.getJob(a.reminderJobId);
      if (existing) continue;
    }
    const jobId = await scheduleReminder(a as any);
    await prisma.activity.update({ where: { id: a.id }, data: { reminderJobId: jobId } });
    scheduled++;
  }
  logger.info({ scheduled }, "reminder.reenqueue.done");
}
```

- [ ] **Step 4: Atualizar `src/lib/worker/index.ts`** — chamar `reenqueuePendingReminders()` + `startActivityReminderWorker()` no boot.

- [ ] **Step 5: Run tests (mocked queue)**

Test: mock `activityReminderQueue.add` e confirma `scheduleReminder` delay calculado. Mock `findMany` em boot test e confirma `add` chamado para cada pending sem job.

- [ ] **Step 6: Commit** `feat(crm): BullMQ queue activity-reminders + worker + boot reenqueue (Fase 6 T5)`.

---

### Task 6a — UI Timeline + Form modal

**Files:**
- Create: `src/components/activity/activity-timeline.tsx`
- Create: `src/components/activity/activity-form.tsx`

- [ ] **Step 1: ActivityTimeline**

Props: `subjectType`, `subjectId`, `canCreate`, `canEdit`, `canDelete`, `canComplete`. useEffect chama `listActivitiesForSubject`. Renderiza lista ordenada com IconTile por type (call → Phone, meeting → Video, task → CheckSquare, note → FileText, file → Paperclip), status badge, botão complete (se canComplete e status=pending), edit, delete. Motion stagger. Empty state com ícone Clock.

- [ ] **Step 2: ActivityForm**

Props: `type`, `initial?`, `subjectType`, `subjectId`, `onSaved`. Zod local matching server schema. Render fields condicionais por type. timezone select: `Intl.supportedValuesOf('timeZone')` (TypeScript 5+ runtime). assignedTo: lista de users do tenant (fetch `getUsers` da action existente? ou lista simples via memberships).

- [ ] **Step 3: Commit** `feat(crm): ActivityTimeline + ActivityForm components (Fase 6 T6a)`.

---

### Task 6b — Páginas

**Files:**
- Create: `src/app/(protected)/tasks/page.tsx` + `_components/tasks-content.tsx`
- Create: `src/app/(protected)/leads/[id]/activities/page.tsx`
- Create: `src/app/(protected)/contacts/[id]/activities/page.tsx`
- Create: `src/app/(protected)/opportunities/[id]/activities/page.tsx`

- [ ] **Step 1: /tasks** — server component guard `activities:view`; client usa `listMyTasks`.

- [ ] **Step 2: subject activities pages** — cada page resolve subject por id, guard `activities:view`, renderiza `<ActivityTimeline subjectType="lead|contact|opportunity" subjectId={...} canCreate canEdit canDelete canComplete />`.

- [ ] **Step 3: Commit** `feat(crm): páginas /tasks + /<subject>/[id]/activities (Fase 6 T6b)`.

---

### Task 7 — i18n

**Files:**
- Create: `src/locale/packs/br/messages/activities.json`
- Create: `src/locale/packs/us/messages/activities.json`
- Modify: `src/lib/locale/messages.ts`

- [ ] **Step 1: Criar packs** com chaves para `list.title`, `list.empty`, `timeline.title`, `form.{call,meeting,task,note,file}.title`, field labels, action buttons, `reminder.title/setAt/cancel`.

- [ ] **Step 2: Atualizar loader** — adicionar `activities` em ambos locales (seguindo padrão products).

- [ ] **Step 3: `npx tsx scripts/check-i18n-parity.ts`** → OK com `activities` em verificados.

- [ ] **Step 4: Commit** `feat(crm): i18n activities br/us (Fase 6 T7)`.

---

### Task 8 — Memory + Roadmap + Tag

**Files:**
- Create: memory `activity_pattern.md`, `file_storage_pattern.md`, `reminder_pipeline.md`.
- Modify: `docs/superpowers/specs/2026-04-14-roadmap-mestre-design.md` Appendix A.
- Modify: memory `project_crm_phase_status.md`.

- [ ] **Step 1: Memory files**

Cada memory: decisões chave (model polimórfico subject, driver abstraído local/s3, reenqueue no boot).

- [ ] **Step 2: Roadmap Appendix A** — 3 linhas parity (Activities model + timeline, FileStorage driver, Reminders BullMQ).

- [ ] **Step 3: Tag `phase-6-deployed`** + push.

- [ ] **Step 4: Commit e push final.**

---

## Execution Handoff

Plan salvo em `docs/superpowers/plans/2026-04-15-fase-6-activities.md`.

**Subagent-Driven** será usado (padrão do projeto nesta sessão autônoma). Invocar `superpowers:subagent-driven-development` com esta plan.
