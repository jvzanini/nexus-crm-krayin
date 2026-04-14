# Spec: Fase 7c — Email Send + Tracking (consent-gated)

**Data:** 2026-04-15
**Versão:** v3 (inline 2 reviews)
**Depende de:** Fase 7a (schema+crypto+RBAC) ✅, Fase 7b (OAuth refresh funcional — T3/T4 reais). Fase 1b (consent predicates).
**Gate para:** Fase 8 (automation ação send-email), Fase 9 (marketing campaigns).

---

## Changelog

### v2 → v3 (Review 2)
- **ActivityType.email:** adicionar valor ao enum (migration separada). Enum Prisma não aceita adição de valor em MVP sem migration SQL explícita em Postgres → usar `ALTER TYPE ... ADD VALUE`.
- **Tracking pixel endpoint:** `/api/track/open/:id.gif` retorna `204 No Content` quando consent=false (sem gravar `opened_at`). Não retornar pixel dummy — reduz tráfego e sinaliza para web scanners.
- **Link rewriting** opt-in via setting por tenant (`trackLinkEnabled`). MVP 7c entrega só open-pixel; link-tracking (rewriting href para `/api/track/click/:id/...`) fica em Fase 9 junto com campanha.
- **Threading normalization:** `threadKey = primeiro messageId da thread` — calculado quando insere message: se `inReplyTo` está set e há message anterior com `message_id=inReplyTo` no mesmo tenant, copia `thread_key`. Senão usa o próprio `message_id`. Conservative fallback.
- **Attachment support:** reuso de `ActivityFile` já criado em Fase 6. Send adiciona como `nodemailer` attachment via `driver.get(storageKey)` stream.

### v1 → v2 (Review 1)
- Send action vira método da Activity (type=email). Cria Activity + EmailMessage + envia em transação best-effort (se send falha, status activity = failed; Activity é desfeita? **não** — mantém com `error` flag para investigação).
- Pixel tracking gated em `canTrackOpen(db, contactId)` de `@/lib/consent` (Fase 1b).

---

## 1. Objetivo

1. Enviar email via mailbox conectada (Gmail/Outlook API ou SMTP) a partir da UI timeline de um subject (lead/contact).
2. Criar Activity type=email + EmailMessage row em transação.
3. Tracking pixel de abertura **condicional a `consent_tracking`**.
4. Threading básico via Message-ID e In-Reply-To.

## 2. Escopo

### 2.1. Schema migration

`prisma/migrations/20260421000000_activity_type_email/migration.sql`:
```sql
BEGIN;
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'email';
COMMIT;
```

`down.sql`: remapeamento (análogo à migração `NotificationType.activity_reminder`).

### 2.2. Server action `sendEmailAction`

`src/lib/actions/email-send.ts`:

```ts
sendEmailAction({
  mailboxId: string,
  to: string[],
  cc?: string[],
  bcc?: string[],
  subject: string,
  bodyText?: string,
  bodyHtml?: string,
  inReplyTo?: string,
  subjectType?: "lead" | "contact" | "opportunity",
  subjectId?: string,
  attachmentFileIds?: string[],
  trackOpens?: boolean,
}): Promise<ActionResult<{activityId, messageId}>>;
```

Fluxo:
1. `requirePermission("email:send")` + tenant scope.
2. Carrega mailbox, `decryptMailboxTokens(mailbox)`.
3. Gera `messageId = <crm.${uuid()}@${tenant.domain || "nexuscrm.local"}>`.
4. Resolve `threadKey`: se `inReplyTo`, busca message anterior no tenant; senão `threadKey = messageId`.
5. Se `subjectType === "contact"` e `trackOpens`: `trackOpenResolved = await canTrackOpen(db, subjectId, "contact")`. Senão `false`.
6. Monta HTML: se `trackOpenResolved && bodyHtml`, injeta `<img src="/api/track/open/${messageId}.gif" width=1 height=1 alt="" style="display:none">` antes do `</body>` (ou append).
7. Transaction:
   - Cria Activity `type=email`, title=subject, description=bodyText, scheduledAt=now, status=completed.
   - Cria EmailMessage referenciando activity + mailbox + tenant.
8. Send via provider:
   - Gmail: `gmail.users.messages.send({ raw: base64url(mimeMessage) })` com `googleapis`.
   - Outlook: `/me/sendMail` Graph API com MSAL access token.
   - IMAP/SMTP: `nodemailer.createTransport` + `sendMail`.
   - Attachments: loop `driver.get(storageKey)` → stream na mensagem MIME.
9. Update EmailMessage `sent_at=now()`. Revalidate timeline path.

Erro de send: log + update EmailMessage com `sent_at=null` e flag de erro (adicionar coluna `send_error_message TEXT?` em migration 7c).

### 2.3. Tracking pixel endpoint

`/api/track/open/[messageId]/route.ts`:

```ts
export async function GET(req: NextRequest, { params }) {
  const { messageId } = await params;
  const mid = messageId.replace(/\.gif$/, "");

  const msg = await prisma.emailMessage.findFirst({
    where: { messageId: mid, trackingEnabled: true },
    include: { activity: true },
  });

  // Gating: idempotent + consent
  if (msg && !msg.openedAt) {
    // Re-check consent (em caso de revogação pós-send)
    if (msg.subjectType === "contact" && msg.subjectId) {
      const ok = await canTrackOpen(prisma, msg.subjectId, "contact");
      if (!ok) {
        return new Response(null, { status: 204 });
      }
    }
    await prisma.emailMessage.update({
      where: { id: msg.id },
      data: { openedAt: new Date() },
    });
    logger.info({ messageId: mid }, "email.tracking.opened");
  }

  // Retornar 1x1 GIF transparent
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  return new Response(gif, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
}
```

### 2.4. UI — Email compose

`<EmailComposeDialog>` component no timeline:
- Campos: From (select mailbox ativa do user), To (multi-input com badges), Cc/Bcc (collapsible), Subject, Body (textarea simples — rich editor em 1d), checkbox "Rastrear abertura" (default conforme `consent_tracking` do subject; disabled se false com tooltip "Subject opt-out de tracking").
- Attachment section: lista ActivityFiles existentes no subject para reuso; upload novo também.
- Submit chama `sendEmailAction`. Estados: sending spinner, sent toast.

### 2.5. i18n

Pack `emails.json` br/us:
- `compose.title`, `compose.from`, `compose.to`, `compose.cc`, `compose.bcc`, `compose.subject`, `compose.body`, `compose.trackOpens.label`, `compose.trackOpens.disabled`, `compose.send`, `compose.sending`, `compose.success`, `compose.error`.
- `timeline.emailSent`, `timeline.emailOpened`, `timeline.replyTo`.

### 2.6. Fora de escopo

- Link-tracking (rewriting) — Fase 9.
- Unsubscribe link — Fase 9.
- Receber emails (IMAP IDLE / Gmail push) — Fase 7d (futura).
- Rich HTML editor — Fase 1d DS v0.4.0.
- Template library — Fase 9.

## 3. Testes

- Unit: `buildMimeMessage({...})` gera headers corretos (Message-ID, In-Reply-To, References).
- Unit: pixel injection idempotente (HTML já com pixel não duplica).
- Integration: mock providers (gmail/outlook/smtp) — confirma chamada com raw esperado.
- E2E: seller envia email para contact com `consent_tracking=true`, pixel registra opened_at. Contact com consent=false, pixel retorna 204.

## 4. Riscos

| Risco | Sev | Mitigação |
|-------|-----|-----------|
| Token expirado durante send | Médio | Pré-check: se `accessTokenExpAt < now + 30s`, chama refresh antes de enviar. |
| Subject deletado entre compose e send | Baixo | Validação no início da transaction. |
| Pixel bypass via prefetch (Gmail/Outlook cache image) | Alto conhecido | **Aceitar limitação.** Providers pré-fetcham imagens → open pode ser registrado sem humano ter visto. Documentar em `docs/lgpd.md` como "limitação técnica do mercado; não infere intenção humana". |
| Provider marca como spam | Alto | Requer SPF/DKIM no domínio do remetente (setup externo Fase 9). |
| Attachment grande quebra limite provider | Médio | Gmail 25MB / Outlook 20MB. Enforcer no upload (já 25MB); warning no compose se attachment set > limite provider selecionado. |

## 5. Aceite

- Migration `activity_type_email` aplicada.
- `sendEmailAction` funcional via IMAP/SMTP (mínimo) em staging.
- Pixel endpoint responde corretamente a ambas condições consent.
- UI compose renderiza e submete.
- 10+ unit tests.

## 6. Convenção commits

- `feat(crm): migration ActivityType.email (Fase 7c T1)`
- `feat(crm): sendEmailAction + provider dispatch (Fase 7c T2)`
- `feat(crm): tracking pixel endpoint (Fase 7c T3)`
- `feat(crm): EmailComposeDialog + timeline send button (Fase 7c T4)`
- `feat(crm): i18n emails br/us (Fase 7c T5)`

## 7. Dependências

- `googleapis` (send via gmail.users.messages.send) — já em 7b T1.
- `nodemailer` — SMTP send.
- `@azure/msal-node` + Graph API fetch (não precisa SDK separado para /sendMail).
- `canTrackOpen` — de `@/lib/consent` (Fase 1b).
