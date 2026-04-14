# Spec: Fase 7 — Email Integration

**Data:** 2026-04-15
**Versão:** v3 (inline 2 reviews)
**Depende de:** Fase 6 (activities timeline) ✅. Fase 1b (consent: `consent_tracking` gating). Fase 1c (flags + logger).
**Gate para:** Fase 8 (automation actions "send-email"), Fase 9 (campanhas).

---

## Changelog

### v2 → v3 (Review 2 profunda)
- **Dividido em 7a/7b/7c:**
  - **7a** — schema (mailbox + message + thread) + RBAC + crypto helper local (AES-256-GCM) — entregável standalone.
  - **7b** — OAuth Google/Microsoft fluxo (callbacks /api/oauth/*). Refresh token rotation. Requer secrets externos.
  - **7c** — send via Activity (usando mailbox escolhida) + tracking pixel gated por `consent_tracking` + threading básico (Message-ID + In-Reply-To).
- **Crypto local:** em vez de depender de `@nexusai360/encryption` (externo), este CRM inclui `src/lib/crypto/aes-gcm.ts` thin wrapper sobre Node `crypto` (scrypt-derived key from `ENCRYPTION_MASTER_KEY` env; 256-bit; GCM; IV 12B; authTag 16B). Migrar para package externo em Fase 12 se disponível.
- **IMAP/SMTP fallback:** especificado, mas implementação em 7b. MVP de 7a só modela tabela e RBAC.
- **Tracking pixel:** endpoint `/api/track/open/:messageId.gif` (1x1 GIF transparent). Antes de servir, checa `canTrackOpen(db, contactId)` — se false, retorna 204 sem gravar.
- **Threading:** Message-ID gerado pelo CRM no formato `<crm.<uuid>@<tenant-domain>>`. Reply stitched via `In-Reply-To` do header recebido.

### v1 → v2 (Review 1 ampla)
- Fora de escopo: mailbox compartilhada entre usuários; templates complexos; anexos em send (usa activity file já).
- Mailbox por usuário (1-N), um primary por usuário. Tenant-scope obrigatório.
- **Encryption separada por mailbox:** `refresh_token_enc` + `access_token_enc`. IV/authTag armazenados com ciphertext (base64).

---

## 1. Objetivo

1. Usuário conecta mailbox (Gmail OAuth, Outlook OAuth, IMAP/SMTP custom).
2. Envio de email via Activity type `email` (subset do type `note`/`call` ou novo type?). **Decisão:** adicionar `ActivityType.email` ao enum em 7c.
3. Tracking de abertura/clique só quando `consent_tracking === true` no subject.
4. Threading: messages de mesma thread aparecem agrupadas no timeline.

## 2. Escopo

### 2.1. Schema (entregue em 7a)

```prisma
enum MailboxProvider {
  gmail
  outlook
  imap_smtp
}

model Mailbox {
  id                 String          @id @default(uuid()) @db.Uuid
  companyId          String          @map("company_id") @db.Uuid
  userId             String          @map("user_id") @db.Uuid
  provider           MailboxProvider
  emailAddress       String          @map("email_address")
  displayName        String?         @map("display_name")
  isPrimary          Boolean         @default(false) @map("is_primary")
  isActive           Boolean         @default(true) @map("is_active")

  // OAuth (gmail/outlook)
  accessTokenEnc     String?         @map("access_token_enc")
  accessTokenExpAt   DateTime?       @map("access_token_exp_at")
  refreshTokenEnc    String?         @map("refresh_token_enc")

  // IMAP/SMTP fallback
  imapHost           String?         @map("imap_host")
  imapPort           Int?            @map("imap_port")
  smtpHost           String?         @map("smtp_host")
  smtpPort           Int?            @map("smtp_port")
  authUsername       String?         @map("auth_username")
  authPasswordEnc    String?         @map("auth_password_enc")

  createdAt          DateTime        @default(now()) @map("created_at")
  updatedAt          DateTime        @updatedAt @map("updated_at")

  messages EmailMessage[]

  @@unique([userId, emailAddress], name: "uq_mailbox_user_addr")
  @@index([companyId, isActive], name: "idx_mailbox_active")
  @@map("mailboxes")
}

model EmailMessage {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String   @map("company_id") @db.Uuid
  mailboxId       String   @map("mailbox_id") @db.Uuid

  // threading
  messageId       String   @map("message_id")        // RFC 5322, unique per tenant
  inReplyTo       String?  @map("in_reply_to")
  threadKey       String?  @map("thread_key")        // derivado: primeiro messageId da thread

  // subject refs (timeline)
  subjectType     ActivitySubjectType? @map("subject_type")
  subjectId       String?  @map("subject_id") @db.Uuid
  activityId      String?  @map("activity_id") @db.Uuid

  // content
  fromAddress     String   @map("from_address")
  toAddresses     String[] @map("to_addresses")
  ccAddresses     String[] @map("cc_addresses")
  bccAddresses    String[] @map("bcc_addresses")
  subject         String   @db.VarChar(500)
  bodyText        String?  @map("body_text")
  bodyHtml        String?  @map("body_html") @db.Text

  // tracking
  trackingEnabled Boolean  @default(false) @map("tracking_enabled")
  openedAt        DateTime? @map("opened_at")
  clickedAt       DateTime? @map("clicked_at")

  sentAt          DateTime? @map("sent_at")
  receivedAt      DateTime? @map("received_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  mailbox  Mailbox  @relation(fields: [mailboxId], references: [id], onDelete: Cascade)
  activity Activity? @relation(fields: [activityId], references: [id], onDelete: SetNull)

  @@unique([companyId, messageId], name: "uq_message_per_tenant")
  @@index([companyId, threadKey, sentAt(sort: Desc)], name: "idx_message_thread")
  @@index([companyId, subjectType, subjectId, sentAt(sort: Desc)], name: "idx_message_subject")
  @@map("email_messages")
}
```

Adicionar relation `messages EmailMessage[]` em `Activity` model + enum `ActivityType` ganha valor `email` (em 7c, não 7a).

### 2.2. RBAC (7a)

Adicionar permissions:
- `email:view` — listar mailboxes e mensagens.
- `email:connect` — conectar nova mailbox (OAuth ou IMAP).
- `email:send` — enviar email.
- `email:manage` — revogar mailbox, marcar primary.

Distribuição: super_admin, admin = tudo. Manager = view/send/manage. Seller = view/send (sua própria mailbox). Viewer = view.

### 2.3. Crypto helper (7a)

`src/lib/crypto/aes-gcm.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const MASTER = process.env.ENCRYPTION_MASTER_KEY;
const SCRYPT_SALT = "nexus-crm-v1";

function deriveKey(): Buffer {
  if (!MASTER || MASTER.length < 32) {
    throw new Error("ENCRYPTION_MASTER_KEY must be >= 32 chars");
  }
  return scryptSync(MASTER, SCRYPT_SALT, 32);
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv(12).authTag(16).ciphertext  — all base64
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
```

Unit tests: round-trip de strings curtas/longas/multi-byte; authTag tampering rejeita decrypt; chave inválida rejeita.

### 2.4. OAuth (7b — fora de 7a)

- `/api/oauth/gmail/authorize` redirect para Google.
- `/api/oauth/gmail/callback` troca code por tokens + upsert mailbox.
- Idem outlook.
- Refresh: job periódico (BullMQ, cron) renova tokens expirando em < 10 min.
- **Out of 7a:** implementação depende de `GOOGLE_OAUTH_CLIENT_ID/SECRET` e `MS_OAUTH_*` secrets.

### 2.5. Send + Tracking (7c — fora de 7a)

- `sendEmailAction({ mailboxId, to, cc, bcc, subject, html, text, inReplyTo?, subjectType?, subjectId? })`.
- Gera Message-ID. Insere `<img src="/api/track/open/MSGID.gif">` no HTML apenas se `canTrackOpen(db, contactId) === true` (quando subjectType=contact).
- `/api/track/open/:id.gif` — 1x1 GIF, grava `openedAt` se tracking_enabled e primeira vez.
- Link rewriting para tracking click: idem; só quando consent.

### 2.6. Fora de escopo

- Rich editor para compose — Fase 1d (componente do DS).
- Warm-up de IP dedicado — Fase 9.
- FBL / bounce handling — Fase 9.
- Attachments no send — usa ActivityFile já anexado; upload paralelo pós-7c.

## 3. Aceite (sub-fase)

### 7a
- Migration aplicada: `mailboxes` + `email_messages` + permissions.
- `src/lib/crypto/aes-gcm.ts` com 5+ unit tests verdes.
- `src/lib/rbac/permissions.ts` atualizado + tests.
- Sem OAuth endpoints ainda.

### 7b
- OAuth Google + Outlook end-to-end (manual teste em staging).
- IMAP/SMTP connect.
- Refresh scheduler.

### 7c
- ActivityType `email` no enum.
- `sendEmailAction` funcional com tracking gated.
- Pixel endpoint.
- Timeline em `/leads/[id]/activities` mostra emails.

## 4. Rollback

`git revert` + migration down. Crypto helper permanece (sem side effects). OAuth endpoints retornam 404.

## 5. Convenção commits

- `feat(crm): migration mailboxes + email_messages (Fase 7a T1)`
- `feat(crm): aes-gcm crypto helper (Fase 7a T2)`
- `feat(crm): rbac email:* (Fase 7a T3)`
- `feat(crm): oauth gmail (Fase 7b)` — etc.
- `feat(crm): send email + tracking gated consent (Fase 7c)`

## 6. Dependências

- `googleapis` + `@azure/msal-node` — 7b.
- `nodemailer` — 7b (IMAP/SMTP).
- `imapflow` — 7b (IMAP receive).
- Nenhuma externa em 7a (apenas node:crypto).
