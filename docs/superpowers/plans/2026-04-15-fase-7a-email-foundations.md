# Fase 7a — Email Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps usam checkbox.

**Goal:** Modelar mailbox + email_messages, adicionar permissions email:*, entregar crypto helper AES-256-GCM — base para 7b (OAuth) e 7c (send+tracking).

**Architecture:** Dois models polimórficos (Mailbox 1-N User/Company, EmailMessage 1-N Mailbox) + crypto helper thin wrapper sobre `node:crypto`. RBAC estende matriz existente. Nenhuma dep externa nova em 7a.

**Tech Stack:** Prisma v7, Postgres, Node crypto.

**Spec:** `docs/superpowers/specs/2026-04-15-fase-7-email-integration-design.md` §2.1–2.3.

---

## Changelog

### v2 → v3 inline
- T2 (crypto) entrega **antes** de T1 (migration) — sem crypto, não temos como popular mailbox. Ordem invertida.
- T3 (RBAC) incluído no mesmo PR do T1 para não ter janela onde migration existe mas permissions ainda não.

---

## Tasks

### Task 1 — Crypto helper AES-256-GCM

**Files:**
- Create: `src/lib/crypto/aes-gcm.ts`
- Create: `src/lib/crypto/aes-gcm.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./aes-gcm";

describe("aes-gcm", () => {
  it("round-trip ascii", () => {
    process.env.ENCRYPTION_MASTER_KEY = "a".repeat(32);
    const enc = encrypt("hello world");
    expect(decrypt(enc)).toBe("hello world");
  });
  it("round-trip unicode", () => {
    process.env.ENCRYPTION_MASTER_KEY = "a".repeat(32);
    expect(decrypt(encrypt("olá 🌱"))).toBe("olá 🌱");
  });
  it("tamper auth tag rejects", () => {
    process.env.ENCRYPTION_MASTER_KEY = "a".repeat(32);
    const enc = encrypt("secret");
    const buf = Buffer.from(enc, "base64");
    buf[12] ^= 0xff; // flip bit do authTag
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });
  it("missing key throws", () => {
    delete process.env.ENCRYPTION_MASTER_KEY;
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_MASTER_KEY/);
  });
  it("short key throws", () => {
    process.env.ENCRYPTION_MASTER_KEY = "short";
    expect(() => encrypt("x")).toThrow(/32 chars/);
  });
});
```

- [ ] **Step 2: Implementation per spec §2.3**

- [ ] **Step 3: Run tests**

`npx vitest run src/lib/crypto --environment=node` → 5 passing.

- [ ] **Step 4: Commit** `feat(crm): aes-gcm crypto helper (Fase 7a T1)`.

### Task 2 — RBAC email:*

**Files:**
- Modify: `src/lib/rbac/permissions.ts`
- Modify: `src/lib/rbac/rbac.test.ts`

- [ ] **Step 1: Append permissions**

```ts
"email:view", "email:connect", "email:send", "email:manage",
```

Role map:
- super_admin/admin: tudo.
- manager: view/send/manage.
- seller: view/send.
- viewer: view.

- [ ] **Step 2: Tests**

4 novos tests cobrindo distribuição por role.

- [ ] **Step 3: Run tests** verde.

- [ ] **Step 4: Commit** `feat(crm): rbac email:* (Fase 7a T2)`.

### Task 3 — Migration + schema Mailbox + EmailMessage

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260419000000_email_foundations/migration.sql`
- Create: `prisma/migrations/20260419000000_email_foundations/down.sql`

- [ ] **Step 1: Schema edits**

Adicionar enum `MailboxProvider`, models `Mailbox` + `EmailMessage` per spec §2.1.

- [ ] **Step 2: `npx prisma validate`** → valid.

- [ ] **Step 3: SQL migration**

```sql
BEGIN;
CREATE TYPE "MailboxProvider" AS ENUM ('gmail','outlook','imap_smtp');

CREATE TABLE "mailboxes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "provider" "MailboxProvider" NOT NULL,
  "email_address" TEXT NOT NULL,
  "display_name" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "access_token_enc" TEXT,
  "access_token_exp_at" TIMESTAMP(3),
  "refresh_token_enc" TEXT,
  "imap_host" TEXT, "imap_port" INTEGER,
  "smtp_host" TEXT, "smtp_port" INTEGER,
  "auth_username" TEXT, "auth_password_enc" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_mailbox_user_addr" ON "mailboxes" ("user_id","email_address");
CREATE INDEX "idx_mailbox_active" ON "mailboxes" ("company_id","is_active");

CREATE TABLE "email_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "mailbox_id" UUID NOT NULL,
  "message_id" TEXT NOT NULL,
  "in_reply_to" TEXT,
  "thread_key" TEXT,
  "subject_type" "ActivitySubjectType",
  "subject_id" UUID,
  "activity_id" UUID,
  "from_address" TEXT NOT NULL,
  "to_addresses" TEXT[] NOT NULL DEFAULT '{}',
  "cc_addresses" TEXT[] NOT NULL DEFAULT '{}',
  "bcc_addresses" TEXT[] NOT NULL DEFAULT '{}',
  "subject" VARCHAR(500) NOT NULL,
  "body_text" TEXT,
  "body_html" TEXT,
  "tracking_enabled" BOOLEAN NOT NULL DEFAULT false,
  "opened_at" TIMESTAMP(3),
  "clicked_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "received_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_message_per_tenant" ON "email_messages" ("company_id","message_id");
CREATE INDEX "idx_message_thread" ON "email_messages" ("company_id","thread_key","sent_at" DESC);
CREATE INDEX "idx_message_subject" ON "email_messages" ("company_id","subject_type","subject_id","sent_at" DESC);

ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_mailbox_id_fkey"
  FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
```

- [ ] **Step 4: down.sql**

```sql
BEGIN;
DROP TABLE "email_messages";
DROP TABLE "mailboxes";
DROP TYPE "MailboxProvider";
COMMIT;
```

- [ ] **Step 5: `npx prisma generate`** + commit `feat(crm): migration mailboxes + email_messages + enum provider (Fase 7a T3)`.

### Task 4 — Memory + Roadmap

**Files:**
- Create memory: `email_foundations.md`.
- Modify: `docs/superpowers/specs/2026-04-14-roadmap-mestre-design.md` Appendix A.

- [ ] **Step 1: Memory** sobre `encrypt`/`decrypt` contract + env `ENCRYPTION_MASTER_KEY`.

- [ ] **Step 2: Appendix A** 3 linhas:
  - `Foundations Email (schema + crypto) | 7a | parity`
  - `Mailbox model + OAuth fields | 7a | parity`
  - `RBAC email:* | 7a | parity`

- [ ] **Step 3: Commit + push** `docs(fase-7a): roadmap + memory`.

### Task 5 — Tag 7a

- [ ] `git tag -a phase-7a-deployed -m "Fase 7a — Email Foundations (schema + crypto + RBAC)"` + push.
