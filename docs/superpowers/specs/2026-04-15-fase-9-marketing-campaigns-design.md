# Spec: Fase 9 — Marketing Campaigns

**Data:** 2026-04-15
**Versão:** v3 (inline 2 reviews)
**Depende de:** Fase 5 (custom attrs — bloqueada em 1d), Fase 7c (send+tracking — bloqueada em 7b real), Fase 8 (automation engine) ✅.
**Gate para:** Fase 11 (reports de campanha), Fase 12 (LGPD endpoints para opt-out).

---

## Changelog

### v2 → v3 (Review 2)
- **Split em 9.0 e 9.1:**
  - **9.0 — Core engine:** schema Campaign + CampaignRecipient + Segment + segment evaluator + scheduler. Usa Fase 8 action `send-email` quando disponível. Implementável em paralelo a 7c se usar stub.
  - **9.1 — Deliverability:** SPF/DKIM/DMARC config (docs externa), list-unsubscribe RFC 8058, bounce/complaint handling, FBL, warm-up IP, supressão automática. Requer 7c real + setup externo (DNS).
- **Segment via custom attrs (Fase 5):** como 5 está bloqueada, MVP 9.0 aceita **segment simples** via filtros nativos (campos diretos de Contact: email, organization, createdAt range, consentMarketing=true). Custom attrs agregam em 9.2 pós-Fase 5.
- **Fila dedicada:** BullMQ queue `marketing-send` **separada** de `email` transacional. Prioridade baixa. Evita que burst de campanha atrase email transacional (password-reset, verify-email).
- **Quota diária por tenant:** setting `marketingDailyQuota` (default 5000). Counter Redis análogo ao anti-storm de automation. Excedeu → campanha pausada automaticamente + notification.
- **Opt-out obrigatório:** todo email de campanha inclui link `/unsubscribe/:token` (token HMAC do contactId + campaignId). Click grava em `consent_logs` com `source='campaign_unsubscribe'` + set `consentMarketing=false`.
- **Segmentação pré-send:** ao enfileirar, filtra **novamente** por `canSendMarketing(db, contactId)` — se false, skip + log. Evita race: consent revogado entre agendamento e envio.

### v1 → v2 (Review 1)
- Campaign status: `draft | scheduled | sending | sent | paused | canceled | failed`.
- Batch size configurável (default 100/min, rate limit via BullMQ backoff).
- Template inline em MVP (HTML cru no body); template reusable vai para 9.2.
- A/B testing fora de escopo em 9.0.

---

## 1. Objetivo

1. Enviar campanha de email em massa para **segmento** de contatos.
2. Segmento em 9.0: filtros nativos (AND). Custom-attr filters em 9.2 (pós-Fase 5).
3. Respeitar LGPD: só enfileira contatos com `consentMarketing=true`; todo email tem unsubscribe; opt-out imediato.
4. Fila dedicada com quota e rate-limit.
5. Tracking de open/click (via 7c gating).
6. Dashboard de métricas por campanha.

## 2. Escopo

### 2.1. Schema (9.0)

```prisma
enum CampaignStatus {
  draft
  scheduled
  sending
  sent
  paused
  canceled
  failed
}

enum RecipientStatus {
  pending
  sent
  failed
  skipped_consent
  skipped_quota
  bounced
  complained
  unsubscribed
}

model Segment {
  id          String   @id @default(uuid()) @db.Uuid
  companyId   String   @map("company_id") @db.Uuid
  name        String
  description String?
  // Filtro declarativo: [{field, op, value}] — mesma estrutura de automation.conditions
  filters     Json
  createdBy   String   @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  campaigns Campaign[]

  @@index([companyId, updatedAt(sort: Desc)], name: "idx_segment_recent")
  @@map("segments")
}

model Campaign {
  id            String         @id @default(uuid()) @db.Uuid
  companyId     String         @map("company_id") @db.Uuid
  name          String
  subject       String         @db.VarChar(500)
  bodyHtml      String         @db.Text @map("body_html")
  mailboxId     String         @map("mailbox_id") @db.Uuid
  segmentId     String         @map("segment_id") @db.Uuid
  status        CampaignStatus @default(draft)
  scheduledAt   DateTime?      @map("scheduled_at")
  startedAt     DateTime?      @map("started_at")
  finishedAt    DateTime?      @map("finished_at")
  batchSize     Int            @default(100) @map("batch_size")
  createdBy     String         @map("created_by") @db.Uuid
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  segment    Segment             @relation(fields: [segmentId], references: [id], onDelete: Restrict)
  recipients CampaignRecipient[]

  @@index([companyId, status, scheduledAt], name: "idx_campaign_queue")
  @@map("campaigns")
}

model CampaignRecipient {
  id          String           @id @default(uuid()) @db.Uuid
  campaignId  String           @map("campaign_id") @db.Uuid
  contactId   String           @map("contact_id") @db.Uuid
  messageId   String?          @map("message_id")  // referencia EmailMessage.messageId
  status      RecipientStatus  @default(pending)
  errorMessage String?         @map("error_message")
  sentAt      DateTime?        @map("sent_at")
  openedAt    DateTime?        @map("opened_at")
  clickedAt   DateTime?        @map("clicked_at")
  unsubscribedAt DateTime?     @map("unsubscribed_at")

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([campaignId, contactId], name: "uq_recipient_per_contact")
  @@index([campaignId, status], name: "idx_recipient_status")
  @@map("campaign_recipients")
}
```

Adicionar enum `ConsentSource` (em `src/lib/consent/types.ts`) valor `"campaign_unsubscribe"`.

### 2.2. Segment evaluator

`src/lib/marketing/segment.ts`:
- `resolveSegment(companyId, filters): Promise<Contact[]>` — traduz filters declarativos para `prisma.contact.findMany({ where: {...} })`.
- Reusa pattern do automation conditions evaluator mas gera queries SQL (não in-memory).
- Operadores suportados (9.0): `eq | neq | in | gt | lt | contains` em campos: `email, organization, title, createdAt, consentMarketing, consentTracking`.
- Custom attrs (Fase 5): não em 9.0.

### 2.3. Server Actions

`src/lib/actions/marketing.ts`:
- `listSegments()` / `createSegment({name, filters})` / `previewSegment(filters)` → count + sample.
- `listCampaigns()` / `getCampaign(id)`.
- `createCampaign({name, subject, bodyHtml, mailboxId, segmentId, scheduledAt?})` — status=`draft`.
- `activateCampaign(id)` — transitiona para `scheduled` (se scheduledAt futuro) ou `sending` (imediato). Popula `campaign_recipients` com contactos do segmento filtrados por `canSendMarketing`.
- `pauseCampaign(id)` / `resumeCampaign(id)` / `cancelCampaign(id)`.
- `getCampaignStats(id)` → counts por status.

RBAC novas permissions:
- `marketing:view`, `marketing:manage`, `marketing:send`.

### 2.4. Queue + Worker

`src/lib/worker/queues/marketing-send.ts`:
- Queue `marketing-send` com `connection: redis`.
- Job `send-one` por recipient. Prioridade baixa (`priority: 10`).
- Rate-limiter: BullMQ `limiter: { max: batchSize, duration: 60_000 }` por campanha (via grupos).

Processor `src/lib/worker/processors/marketing-send.ts`:
- Carrega recipient + contact + campaign.
- Re-check `canSendMarketing(db, contactId)` → if false: status=`skipped_consent`.
- Re-check quota diária: `incrementQuotaOrReject(companyId, dailyQuota)` → if over: status=`skipped_quota` + pausa campanha.
- Injeta unsubscribe link antes do send: `<a href="/unsubscribe/${token}">Cancelar inscrição</a>` onde token = HMAC(contactId+campaignId, secret).
- Chama `sendEmailAction` (Fase 7c) com body customizado (preserva tracking pixel gated).
- On success: recipient status=`sent` + messageId.
- On fail: status=`failed` + errorMessage.

### 2.5. Unsubscribe endpoint

`src/app/api/unsubscribe/[token]/route.ts`:
- Decode HMAC token → `{ contactId, campaignId, timestamp }`.
- Valida HMAC (rejeita tampered).
- Rejeita se timestamp > 90 dias (ativo apenas dentro de 90 dias da campanha).
- Transaction: `recordConsent(tx, { subjectType: "contact", subjectId: contactId, consent: { marketing: false, tracking: currentTracking }, source: "campaign_unsubscribe" })` + `campaign_recipients.unsubscribedAt=now()`.
- Retorna página estática confirmando desinscrição.

### 2.6. UI

- `/marketing/segments` — list + form create (filters declarativos similar a automation UI). Preview count + sample.
- `/marketing/campaigns` — list.
- `/marketing/campaigns/new` — form: name, subject, mailbox select, segment select, bodyHtml (textarea MVP; rich editor em 1d), scheduledAt (optional).
- `/marketing/campaigns/[id]` — preview + stats + actions (activate, pause, cancel) + recipients table (paginated).

### 2.7. Deliverability (9.1 — fora de 9.0)

- SPF/DKIM/DMARC: doc `docs/ops/email-deliverability.md` com runbook DNS por domínio.
- List-Unsubscribe header RFC 8058 (one-click POST).
- Bounce handling: webhook provider (Gmail/Outlook/SES) → recipient.status=`bounced` + auto-suppressão futura.
- Complaint/FBL: idem.
- Warm-up IP: doc para pool dedicado.

### 2.8. Fora de escopo

- A/B testing (Fase 9.2).
- Template library reutilizável (Fase 9.2 + 1d).
- Rich editor (1d).
- Import CSV de contatos (Fase 10).
- Custom attr filters em segment (9.2 pós-Fase 5).
- Analytics dashboard de campanha (Fase 11).

## 3. Testes

### 3.1. Unit (vitest)
- Segment evaluator: 15+ combinações filtro.
- HMAC unsubscribe token: round-trip valid; tamper rejeita; expired rejeita.
- Zod Campaign schema: subject vazio rejeitado; batchSize > 1000 rejeitado.

### 3.2. Integração
- `activateCampaign` filtra por `consentMarketing=true` — contact com opt-out não entra.
- Processor re-check consent: contact revogou entre agendamento e envio → `skipped_consent`.
- Unsubscribe endpoint grava log + set denormalizado.

### 3.3. E2E
- Criar campanha para 3 contatos (2 opt-in, 1 opt-out). Enviar. Confirma 2 em `sent`, 1 em `skipped_consent`.
- Click em unsubscribe link → 200 + consent_log row + subsequent campaign não inclui contato.

## 4. Riscos

| Risco | Sev | Mitigação |
|-------|-----|-----------|
| Duplicate send em retries | Muito alto | BullMQ `jobId: recipient-${id}` + recipient unique `(campaignId, contactId)` + status check antes de enviar. |
| Burst sobrecarrega provider (throttling) | Alto | Rate limiter BullMQ 100/min default; backoff exponencial em 429. |
| Unsubscribe token adulterado | Alto | HMAC SHA-256 + timestamp validation. |
| Opt-out não propagado a campanhas concorrentes | Alto | Re-check `canSendMarketing` **no processor** (não só no scheduler). |
| SPF/DKIM faltando → spam score | Alto conhecido | Doc 9.1 obrigatória antes de launch real. Staging = sem restrição. |
| Campanha grande esgota quota diária | Médio | Auto-pausa ao exceder quota + notifica admin. |
| Unsubscribe spamado (DoS) | Médio | Rate limit 10/min por IP no endpoint. |

## 5. Aceite (9.0)

- Schema aplicado; migrations up+down.
- Segment evaluator com 15+ tests.
- Server Actions com RBAC + Zod.
- Worker + quota + re-check consent.
- Unsubscribe endpoint HMAC-validated.
- UI /marketing/{segments,campaigns} funcional.
- 40+ unit tests.
- Memory: `marketing_pipeline.md`, `unsubscribe_token.md`.

## 6. Rollback

Por ser write-heavy, rollback requer cuidado:
1. `git revert` + migration down (drop campaigns/segments/recipients). `consent_logs` preserva histórico de unsubscribes.
2. Campanhas em flight: jobs BullMQ drenados; recipients pending ficam stuck até next deploy.

## 7. Convenção commits

- `feat(crm): migration marketing (segments + campaigns + recipients) (9.0 T1)`
- `feat(crm): segment evaluator + Zod schemas (9.0 T2)`
- `feat(crm): rbac marketing:* (9.0 T3)`
- `feat(crm): Server Actions marketing (create/activate/pause/stats) (9.0 T4)`
- `feat(crm): unsubscribe HMAC endpoint (9.0 T5)`
- `feat(crm): BullMQ marketing-send queue + worker (9.0 T6)`
- `feat(crm): UI /marketing/{segments,campaigns} (9.0 T7)`
- `docs(crm): docs/ops/email-deliverability.md runbook (9.1)`

## 8. Dependências

- Fase 7c `sendEmailAction` (stub em 9.0 development; real em 9.0 deploy).
- Fase 1b `canSendMarketing`, `recordConsent`.
- Fase 8 anti-storm `incrementQuotaOrReject` helper — **reaproveitar** para marketing quota.
- `node:crypto` para HMAC.
