# Fase 9 — Marketing Campaigns (9.0 core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps usam checkbox (`- [ ]`) para tracking.

**Goal:** Enviar campanhas de email em massa para segmentos, respeitando consent LGPD (canSendMarketing + unsubscribe HMAC), fila dedicada BullMQ, quota diária e re-check de consent pré-envio.

**Architecture:** Schema Campaign + CampaignRecipient + Segment. Server Actions para CRUD + activate. Queue `marketing-send` isolada da `email` transacional. Processor re-verifica consent no envio. Unsubscribe HMAC-tokenizado grava `consent_logs` com source novo.

**Tech Stack:** Prisma v7, BullMQ 5, Zod, next-intl, Sonner, DS v0.3.0, node:crypto HMAC.

**Spec:** `docs/superpowers/specs/2026-04-15-fase-9-marketing-campaigns-design.md`.

**Status:** documento-only nesta sessão — implementação aguarda desbloqueio de Fase 7c (sendEmailAction real). Tasks abaixo são implementáveis em 9.0 com `send-email` stubado, mas tag `phase-9-deployed` requer 7c.

---

## Changelog

### v2 → v3 (Review 2 inline)
- Segment evaluator em 9.0 usa **apenas campos nativos** de Contact (não JSONB custom attrs). Evaluator declarativo idêntico ao automation conditions (reusa operadores).
- Unsubscribe endpoint validação dupla: HMAC válido **E** timestamp < 90d. Sem banco stateful de tokens (todos derivados).
- `ConsentSource` union recebe valor novo `"campaign_unsubscribe"` em T1 (migração + types).

### v1 → v2 (Review 1 inline)
- Worker separado (processor `marketing-send.ts`) — não reusa `email` worker do Resend transacional. Queue própria com prioridade baixa.
- Quota diária reusa `incrementQuotaOrReject` helper de Fase 8 guards.

---

## File Structure

**Create:**
- `prisma/migrations/20260423000000_marketing/migration.sql` + `down.sql`.
- `src/lib/marketing/segment.ts` + `.test.ts`.
- `src/lib/marketing/unsubscribe-token.ts` + `.test.ts` (HMAC sign/verify).
- `src/lib/actions/marketing-segments.ts` + `.test.ts` (Zod-only).
- `src/lib/actions/marketing-campaigns.ts` + `.test.ts`.
- `src/app/api/unsubscribe/[token]/route.ts`.
- `src/lib/worker/queues/marketing-send.ts`.
- `src/lib/worker/processors/marketing-send.ts`.
- `src/app/(protected)/marketing/segments/page.tsx` + `[id]/page.tsx` + `new/page.tsx` + `_components/*`.
- `src/app/(protected)/marketing/campaigns/page.tsx` + `[id]/page.tsx` + `new/page.tsx` + `_components/*`.
- `src/locale/packs/{br,us}/messages/marketing.json`.

**Modify:**
- `prisma/schema.prisma` — enums + models.
- `src/lib/rbac/permissions.ts` — marketing:view/manage/send.
- `src/lib/rbac/rbac.test.ts`.
- `src/lib/consent/types.ts` — adicionar `"campaign_unsubscribe"` em `ConsentSource`.
- `src/lib/locale/messages.ts` — carregar `marketing` pack.
- `src/lib/worker/index.ts` — startar worker marketing-send + shutdown.

---

## Tasks

### Task 1: Migration + Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/consent/types.ts`
- Create: `prisma/migrations/20260423000000_marketing/migration.sql`
- Create: `prisma/migrations/20260423000000_marketing/down.sql`

- [ ] **Step 1: Append em `src/lib/consent/types.ts`**

Atualizar a union type `ConsentSource` para incluir `"campaign_unsubscribe"`:
```ts
export type ConsentSource =
  | "lead_form"
  | "contact_form"
  | "admin_edit"
  | "backfill_migration"
  | "campaign_unsubscribe";
```

- [ ] **Step 2: Append em `prisma/schema.prisma`** (após último bloco existente)

Adicionar enums e 3 models conforme spec §2.1 (`CampaignStatus`, `RecipientStatus`, `Segment`, `Campaign`, `CampaignRecipient`).

- [ ] **Step 3: Validate**

```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin" && npx prisma validate
```
Esperado: `The schema at prisma/schema.prisma is valid 🚀`.

- [ ] **Step 4: `migration.sql`**

```sql
BEGIN;

CREATE TYPE "CampaignStatus" AS ENUM (
  'draft', 'scheduled', 'sending', 'sent', 'paused', 'canceled', 'failed'
);

CREATE TYPE "RecipientStatus" AS ENUM (
  'pending', 'sent', 'failed', 'skipped_consent', 'skipped_quota',
  'bounced', 'complained', 'unsubscribed'
);

CREATE TABLE "segments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "filters" JSONB NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_segment_recent" ON "segments" ("company_id", "updated_at" DESC);

CREATE TABLE "campaigns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "subject" VARCHAR(500) NOT NULL,
  "body_html" TEXT NOT NULL,
  "mailbox_id" UUID NOT NULL,
  "segment_id" UUID NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
  "scheduled_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "batch_size" INTEGER NOT NULL DEFAULT 100,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_campaign_queue" ON "campaigns" ("company_id", "status", "scheduled_at");

CREATE TABLE "campaign_recipients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "message_id" TEXT,
  "status" "RecipientStatus" NOT NULL DEFAULT 'pending',
  "error_message" TEXT,
  "sent_at" TIMESTAMP(3),
  "opened_at" TIMESTAMP(3),
  "clicked_at" TIMESTAMP(3),
  "unsubscribed_at" TIMESTAMP(3),
  CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_recipient_per_contact" ON "campaign_recipients" ("campaign_id", "contact_id");
CREATE INDEX "idx_recipient_status" ON "campaign_recipients" ("campaign_id", "status");

ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_segment_id_fkey"
  FOREIGN KEY ("segment_id") REFERENCES "segments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "campaign_recipients"
  ADD CONSTRAINT "campaign_recipients_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
```

- [ ] **Step 5: `down.sql`**

```sql
BEGIN;
DROP TABLE "campaign_recipients";
DROP TABLE "campaigns";
DROP TABLE "segments";
DROP TYPE "RecipientStatus";
DROP TYPE "CampaignStatus";
COMMIT;
```

- [ ] **Step 6: Commit**

```sh
npx prisma generate
git add prisma/ src/lib/consent/types.ts
git commit -m "feat(crm): migration marketing (segments + campaigns + recipients) + consent source (Fase 9 T1)"
```

### Task 2: Segment evaluator

**Files:**
- Create: `src/lib/marketing/segment.ts`
- Create: `src/lib/marketing/segment.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildWhereFromFilters, type SegmentFilter } from "./segment";

describe("buildWhereFromFilters", () => {
  it("eq simples", () => {
    const f: SegmentFilter[] = [{ field: "consentMarketing", op: "eq", value: true }];
    expect(buildWhereFromFilters(f)).toEqual({
      AND: [{ consentMarketing: true }],
    });
  });
  it("in em email (array)", () => {
    const f: SegmentFilter[] = [
      { field: "email", op: "in", value: ["a@b.com", "c@d.com"] },
    ];
    expect(buildWhereFromFilters(f)).toEqual({
      AND: [{ email: { in: ["a@b.com", "c@d.com"] } }],
    });
  });
  it("contains em organization é case-insensitive", () => {
    const f: SegmentFilter[] = [
      { field: "organization", op: "contains", value: "acme" },
    ];
    expect(buildWhereFromFilters(f)).toEqual({
      AND: [{ organization: { contains: "acme", mode: "insensitive" } }],
    });
  });
  it("gt em createdAt aceita string ISO", () => {
    const f: SegmentFilter[] = [
      { field: "createdAt", op: "gt", value: "2026-01-01T00:00:00Z" },
    ];
    expect(buildWhereFromFilters(f)).toEqual({
      AND: [{ createdAt: { gt: new Date("2026-01-01T00:00:00Z") } }],
    });
  });
  it("field não permitido é ignorado (defense-in-depth)", () => {
    const f: SegmentFilter[] = [{ field: "password", op: "eq", value: "x" }];
    expect(buildWhereFromFilters(f)).toEqual({ AND: [] });
  });
  it("filtros vazios → AND []", () => {
    expect(buildWhereFromFilters([])).toEqual({ AND: [] });
  });
});
```

Run: `npx vitest run src/lib/marketing/segment.test.ts --environment=node`
Expected: FAIL (module não existe ainda).

- [ ] **Step 2: Implementation**

```ts
// src/lib/marketing/segment.ts
export type SegmentOperator = "eq" | "neq" | "in" | "gt" | "lt" | "contains";

export interface SegmentFilter {
  field: string;
  op: SegmentOperator;
  value: unknown;
}

// Allowlist: somente campos nativos de Contact aceitos em 9.0.
const ALLOWED_FIELDS = new Set([
  "email",
  "organization",
  "title",
  "createdAt",
  "consentMarketing",
  "consentTracking",
]);

const DATE_FIELDS = new Set(["createdAt"]);

function convertValue(field: string, value: unknown): unknown {
  if (DATE_FIELDS.has(field) && typeof value === "string") return new Date(value);
  return value;
}

export function buildWhereFromFilters(filters: readonly SegmentFilter[]): {
  AND: Record<string, unknown>[];
} {
  const AND: Record<string, unknown>[] = [];
  for (const f of filters) {
    if (!ALLOWED_FIELDS.has(f.field)) continue;
    const v = convertValue(f.field, f.value);
    switch (f.op) {
      case "eq":
        AND.push({ [f.field]: v });
        break;
      case "neq":
        AND.push({ [f.field]: { not: v } });
        break;
      case "in":
        if (Array.isArray(v)) AND.push({ [f.field]: { in: v } });
        break;
      case "gt":
        AND.push({ [f.field]: { gt: v } });
        break;
      case "lt":
        AND.push({ [f.field]: { lt: v } });
        break;
      case "contains":
        if (typeof v === "string") {
          AND.push({ [f.field]: { contains: v, mode: "insensitive" } });
        }
        break;
    }
  }
  return { AND };
}
```

- [ ] **Step 3: Run tests** verde.

- [ ] **Step 4: Commit** `feat(crm): segment evaluator (Fase 9 T2)`.

### Task 3: Unsubscribe HMAC token

**Files:**
- Create: `src/lib/marketing/unsubscribe-token.ts`
- Create: `src/lib/marketing/unsubscribe-token.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";

describe("unsubscribe token", () => {
  const ORIGINAL = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  beforeEach(() => {
    process.env.UNSUBSCRIBE_TOKEN_SECRET = "a".repeat(32);
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    else process.env.UNSUBSCRIBE_TOKEN_SECRET = ORIGINAL;
  });

  it("round-trip válido", () => {
    const t = signUnsubscribeToken({ contactId: "c1", campaignId: "camp1" });
    expect(verifyUnsubscribeToken(t)).toEqual({
      ok: true,
      payload: { contactId: "c1", campaignId: "camp1" },
    });
  });

  it("tamper rejeita", () => {
    const t = signUnsubscribeToken({ contactId: "c1", campaignId: "camp1" });
    const tampered = t.slice(0, -4) + "xxxx";
    const result = verifyUnsubscribeToken(tampered);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INVALID_SIGNATURE");
  });

  it("expirado rejeita (> 90 dias)", () => {
    const oldIssuedAt = Date.now() - 91 * 24 * 60 * 60 * 1000;
    const t = signUnsubscribeToken(
      { contactId: "c1", campaignId: "camp1" },
      oldIssuedAt,
    );
    const result = verifyUnsubscribeToken(t);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("EXPIRED");
  });

  it("sem SECRET lança", () => {
    delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    expect(() =>
      signUnsubscribeToken({ contactId: "c1", campaignId: "c1" }),
    ).toThrow(/UNSUBSCRIBE_TOKEN_SECRET/);
  });
});
```

- [ ] **Step 2: Implementation**

```ts
// src/lib/marketing/unsubscribe-token.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export interface UnsubscribePayload {
  contactId: string;
  campaignId: string;
}

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  if (!s) throw new Error("UNSUBSCRIBE_TOKEN_SECRET is required");
  if (s.length < 32) throw new Error("UNSUBSCRIBE_TOKEN_SECRET must be >= 32 chars");
  return s;
}

function toB64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(data: string): string {
  return toB64Url(createHmac("sha256", secret()).update(data).digest());
}

export function signUnsubscribeToken(
  payload: UnsubscribePayload,
  issuedAtMs: number = Date.now(),
): string {
  const body = `${payload.contactId}.${payload.campaignId}.${issuedAtMs}`;
  const sig = sign(body);
  return `${toB64Url(Buffer.from(body))}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: UnsubscribePayload }
  | { ok: false; reason: "MALFORMED" | "INVALID_SIGNATURE" | "EXPIRED" };

export function verifyUnsubscribeToken(token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "MALFORMED" };

  const [bodyB64, sig] = parts;
  let body: string;
  try {
    body = Buffer.from(bodyB64, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }

  const expectedSig = sign(body);
  const provided = Buffer.from(sig, "base64url");
  const expected = Buffer.from(expectedSig, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }

  const bodyParts = body.split(".");
  if (bodyParts.length !== 3) return { ok: false, reason: "MALFORMED" };
  const [contactId, campaignId, issuedAtStr] = bodyParts;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return { ok: false, reason: "MALFORMED" };

  if (Date.now() - issuedAt > MAX_AGE_MS) {
    return { ok: false, reason: "EXPIRED" };
  }

  return { ok: true, payload: { contactId, campaignId } };
}
```

- [ ] **Step 3: Run tests** verde.

- [ ] **Step 4: Commit** `feat(crm): unsubscribe HMAC token (Fase 9 T3)`.

### Task 4: RBAC marketing:*

**Files:**
- Modify: `src/lib/rbac/permissions.ts`
- Modify: `src/lib/rbac/rbac.test.ts`

- [ ] **Step 1: Append em `PERMISSIONS`**

```ts
"marketing:view",
"marketing:manage",
"marketing:send",
```

- [ ] **Step 2: Roles**

- super_admin: já `[...PERMISSIONS]`.
- admin: append `"marketing:view", "marketing:manage", "marketing:send"`.
- manager: append `"marketing:view", "marketing:send"` (sem manage).
- seller: append `"marketing:view"`.
- viewer: append `"marketing:view"`.

- [ ] **Step 3: Tests**

Add:
```ts
it("admin tem marketing:manage e marketing:send", () => {
  const a = mkUser("admin");
  expect(userHasPermission(a, "marketing:manage")).toBe(true);
  expect(userHasPermission(a, "marketing:send")).toBe(true);
});
it("manager tem marketing:send mas NÃO manage", () => {
  const m = mkUser("manager");
  expect(userHasPermission(m, "marketing:send")).toBe(true);
  expect(userHasPermission(m, "marketing:manage")).toBe(false);
});
it("seller tem marketing:view mas NÃO send/manage", () => {
  const s = mkUser("seller");
  expect(userHasPermission(s, "marketing:view")).toBe(true);
  expect(userHasPermission(s, "marketing:send")).toBe(false);
  expect(userHasPermission(s, "marketing:manage")).toBe(false);
});
```

- [ ] **Step 4: Run tests** verde.

- [ ] **Step 5: Commit** `feat(crm): rbac marketing:* (Fase 9 T4)`.

### Task 5: Server Actions segments

**Files:**
- Create: `src/lib/actions/marketing-segments.ts`
- Create: `src/lib/actions/marketing-segments.test.ts`

- [ ] **Step 1: Exportar schemas Zod + actions**

Pattern idêntico a `src/lib/actions/workflows.ts`:
- `_schemas.createSegmentSchema = z.object({ name: z.string().min(1).max(200), description: z.string().max(2000).optional(), filters: z.array(z.object({ field: z.string(), op: z.enum(["eq","neq","in","gt","lt","contains"]), value: z.any() })).max(20) })`.
- `listSegmentsAction()` — `requirePermission("marketing:view")`.
- `createSegmentAction(input)` — `requirePermission("marketing:manage")`.
- `previewSegmentAction(filters)` — roda `buildWhereFromFilters` + `prisma.contact.count + findMany take:5`. Retorna `{ count, sample }`.
- `deleteSegmentAction(id)` — `requirePermission("marketing:manage")`. Fail se campanha ativa referencia.

- [ ] **Step 2: Test Zod**

Teste schemas cobrindo: name vazio rejeitado, 21 filtros rejeitado, op inválido rejeitado.

- [ ] **Step 3: Commit** `feat(crm): server actions marketing segments (Fase 9 T5)`.

### Task 6: Server Actions campaigns

**Files:**
- Create: `src/lib/actions/marketing-campaigns.ts`
- Create: `src/lib/actions/marketing-campaigns.test.ts`

- [ ] **Step 1: Implementation**

- `listCampaignsAction()` / `getCampaignAction(id)`.
- `createCampaignAction({ name, subject, bodyHtml, mailboxId, segmentId, scheduledAt? })` com Zod.
- `activateCampaignAction(id)`:
  1. `requirePermission("marketing:send")`.
  2. Valida campaign status=`draft`.
  3. Resolve contatos do segmento via `buildWhereFromFilters` + `canSendMarketing` filter: `where: { ...filters, consentMarketing: true }`.
  4. Transaction: insert bulk `campaignRecipients` (status=pending); update campaign.status=`sending` (se scheduledAt passado ou null) ou `scheduled`.
  5. Para cada recipient, enfileira job em `marketing-send` queue com `jobId: mk-${recipient.id}`.
- `pauseCampaignAction(id)` / `resumeCampaignAction(id)` / `cancelCampaignAction(id)`.
- `getCampaignStatsAction(id)` — `groupBy` em recipient.status.

- [ ] **Step 2: Commit** `feat(crm): server actions marketing campaigns (Fase 9 T6)`.

### Task 7: Queue + Worker marketing-send

**Files:**
- Create: `src/lib/worker/queues/marketing-send.ts`
- Create: `src/lib/worker/processors/marketing-send.ts`
- Create: `src/lib/worker/marketing-send.test.ts`
- Modify: `src/lib/worker/index.ts`

- [ ] **Step 1: Queue**

```ts
import { Queue } from "bullmq";
import { redis } from "@/lib/redis";
export const MARKETING_SEND_QUEUE = "marketing-send";
export const marketingSendQueue = new Queue(MARKETING_SEND_QUEUE, {
  connection: redis,
});

export async function enqueueMarketingSend(recipientId: string): Promise<void> {
  await marketingSendQueue.add(
    "send-one",
    { recipientId },
    {
      jobId: `mk-${recipientId}`,
      priority: 10,
      removeOnComplete: true,
      removeOnFail: 1000,
    },
  );
}
```

- [ ] **Step 2: Processor**

- Carrega recipient + contact + campaign + mailbox.
- Se `campaign.status !== "sending"` → skip (worker gracefully handles pause).
- `canSendMarketing(db, contact.id, "contact")` → if false, status=`skipped_consent`.
- `incrementQuotaOrReject(companyId, marketingDailyQuota)` → se over, status=`skipped_quota` + `pauseCampaign`.
- Injeta unsubscribe link antes do `</body>`: `const token = signUnsubscribeToken({...}); const link = "/unsubscribe/" + token; bodyHtml += "<p style='...'><a href='" + link + "'>Cancelar inscrição</a></p>";`.
- Chama `sendEmailAction(...)` (stub em dev → retorna skipped; real em Fase 7c).
- Update recipient status/sentAt/messageId.

- [ ] **Step 3: Startar no boot**

Em `src/lib/worker/index.ts`: `const marketingWorker = startMarketingSendWorker();` + adicionar a `shutdown()`.

- [ ] **Step 4: Commit** `feat(crm): BullMQ marketing-send queue + worker (Fase 9 T7)`.

### Task 8: Unsubscribe endpoint

**Files:**
- Create: `src/app/api/unsubscribe/[token]/route.ts`

- [ ] **Step 1: Handler**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordConsent } from "@/lib/consent";
import { verifyUnsubscribeToken } from "@/lib/marketing/unsubscribe-token";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = verifyUnsubscribeToken(token);
  if (!result.ok) {
    logger.warn({ reason: result.reason }, "unsubscribe.invalid_token");
    return new Response(renderPage("Link inválido ou expirado."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const { contactId, campaignId } = result.payload;

  try {
    await prisma.$transaction(async (tx) => {
      const contact = await tx.contact.findUnique({ where: { id: contactId } });
      if (!contact) return;

      await recordConsent(tx, {
        subjectType: "contact",
        subjectId: contactId,
        consent: { marketing: false, tracking: contact.consentTracking },
        source: "campaign_unsubscribe",
      });

      await tx.campaignRecipient.updateMany({
        where: { campaignId, contactId },
        data: { status: "unsubscribed", unsubscribedAt: new Date() },
      });
    });

    logger.info({ contactId, campaignId }, "unsubscribe.processed");
    return new Response(renderPage("Inscrição cancelada com sucesso."), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    logger.error({ err, contactId, campaignId }, "unsubscribe.failed");
    return new Response(renderPage("Erro ao processar desinscrição."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

function renderPage(message: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${message}</title><style>body{font-family:system-ui;max-width:480px;margin:4rem auto;padding:1rem;color:#111}.card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:1.5rem}</style></head><body><div class="card"><h1>${message}</h1><p>Você não receberá mais e-mails de marketing deste remetente.</p></div></body></html>`;
}
```

- [ ] **Step 2: Verify**

Rode `npx vitest run src/lib/marketing --environment=node` para garantir que HMAC continua verde.

- [ ] **Step 3: Commit** `feat(crm): /api/unsubscribe/[token] HMAC-validated (Fase 9 T8)`.

### Task 9: i18n marketing pack

**Files:**
- Create: `src/locale/packs/br/messages/marketing.json`
- Create: `src/locale/packs/us/messages/marketing.json`
- Modify: `src/lib/locale/messages.ts`

- [ ] **Step 1: Packs com 35+ keys**

Seções: `segments.{list,form,action}`, `campaigns.{list,form,stats,action,status}`, `recipientStatus.{pending,sent,failed,skipped_consent,...}`, `unsubscribe.{page.title,page.body}`.

- [ ] **Step 2: Loader**

Padrão idêntico a `products`/`activities`/`mailboxes`/`automation`: adicionar `marketing` nos dois branches.

- [ ] **Step 3: Parity check**

```sh
npx tsx scripts/check-i18n-parity.ts
```
Esperado: `✓ i18n parity OK — verificados: [activities, auth, automation, consent, mailboxes, marketing, products, validation]`.

- [ ] **Step 4: Commit** `feat(crm): i18n marketing br/us (Fase 9 T9)`.

### Task 10: UI `/marketing/segments` + `/marketing/campaigns`

**Files:**
- Create: `src/app/(protected)/marketing/segments/page.tsx` + `_components/segments-list-content.tsx` + `_components/segment-editor-content.tsx`
- Create: `src/app/(protected)/marketing/segments/new/page.tsx`
- Create: `src/app/(protected)/marketing/segments/[id]/page.tsx`
- Create: `src/app/(protected)/marketing/campaigns/page.tsx` + `_components/campaigns-list-content.tsx` + `_components/campaign-editor-content.tsx` + `_components/campaign-stats-content.tsx`
- Create: `src/app/(protected)/marketing/campaigns/new/page.tsx`
- Create: `src/app/(protected)/marketing/campaigns/[id]/page.tsx`

- [ ] **Step 1: Server pages com guard**

Pattern idêntico a `workflows`: server component com guard `marketing:view`, prop `canManage`, `canSend` para client.

- [ ] **Step 2: Segment editor**

Form com name, description, filters block builder (reutiliza estilo de `workflow-editor-content.tsx` conditions section). Botão "Prévia" chama `previewSegmentAction` e mostra `{count, sample}` em Card.

- [ ] **Step 3: Campaign editor**

Form: name, subject, mailbox select (lista `listMailboxes`), segment select, bodyHtml textarea (MVP), scheduledAt (datetime-local opcional). Botões: "Salvar rascunho", "Ativar agora", "Agendar".

- [ ] **Step 4: Campaign stats**

Página `[id]` mostra card com counters por status (pending/sent/failed/skipped_*/...). Motion itemVariants. Botões pause/resume/cancel.

- [ ] **Step 5: Commit** `feat(crm): UI /marketing/{segments,campaigns} (Fase 9 T10)`.

### Task 11: Memory + Roadmap + Tag

**Files:**
- Create memory: `marketing_pipeline.md`, `unsubscribe_token.md`.
- Modify: `docs/superpowers/specs/2026-04-14-roadmap-mestre-design.md` (Appendix A).
- Modify: memory `project_crm_phase_status.md`.

- [ ] **Step 1: Memory `marketing_pipeline.md`** — pipeline Campaign → queue → re-check consent → send → tracking.

- [ ] **Step 2: Memory `unsubscribe_token.md`** — HMAC SHA-256, 90 dias TTL, `UNSUBSCRIBE_TOKEN_SECRET` ≥ 32 chars env.

- [ ] **Step 3: Roadmap Appendix A**

Adicionar 6+ linhas `parity`/`partial`:
- Marketing Segment + Campaign + Recipient schema.
- Segment evaluator.
- RBAC marketing:*.
- Unsubscribe HMAC endpoint.
- Queue marketing-send + worker.
- UI /marketing/*.

- [ ] **Step 4: Tag**

```sh
git tag -a phase-9-deployed -m "Fase 9 entregue — Marketing Campaigns 9.0 (segments, campaigns, recipients, queue isolada, unsubscribe HMAC, re-check consent)"
git push origin main
git push origin phase-9-deployed
```

**NOTA:** tag `phase-9-deployed` só é aplicável quando Fase 7c `sendEmailAction` estiver funcional. Até lá, processor marketing-send apenas marca `skipped` com reason "7c pendente". Tag `phase-9-core-deployed` pode ser usada como alternativa para marcar o schema/lib/UI sem send real.

---

## Bloqueadores externos

- Fase 5 (custom attrs) → segment filtros JSONB custom (entra em 9.2).
- Fase 7c `sendEmailAction` funcional → processor real.
- SPF/DKIM/DMARC DNS config → doc 9.1.
- Secret `UNSUBSCRIBE_TOKEN_SECRET` configurado em Portainer antes do launch.
