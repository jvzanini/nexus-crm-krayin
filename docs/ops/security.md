# Security — Nexus CRM

**Versão:** 1.0 (Fase 12.4)
**Última revisão:** 2026-04-14
**Auditor:** Claude Opus 4.6 (1M context) em sessão autônoma
**Próxima revisão:** 2026-05-14 ou mudança significativa de arquitetura

Doc canônico de segurança. Lista os controles ativos, pendentes, modelo
de ameaças, runbook de incidente, e histórico de auditoria.

Complementar: `docs/ops/security-audit-checklist.md` (checklist OWASP).

---

## 1. Controles ativos

### 1.1 Transport

- **HTTPS** enforced via reverse proxy (Caddy/Traefik) no Portainer stack.
- **HSTS** `max-age=63072000; includeSubDomains; preload` — 2 anos.

### 1.2 Authentication & Sessions

- **NextAuth v5** com JWT stateless (`trustHost: true`, `maxAge` default 30d).
- **bcrypt cost=12** em password hashing.
- **Rate limit login** 3 tiers (`src/lib/rate-limit.ts` + `src/lib/auth-helpers.ts`):
  tier 1 por email, tier 2 por IP, tier 3 global.
- **Password reset** via token 1h TTL + Resend.
- **Email verification** via token 1h TTL.
- **System user** fixo em `00000000-0000-0000-0000-000000000000` (super_admin
  usado por automation actions).

### 1.3 Authorization

- **RBAC** 21+ permissions × 5 roles em `src/lib/rbac/permissions.ts`.
- **Tenant scoping** em Lead/Contact/Opportunity (Frente 17): Server Actions
  chamam `requireActiveCompanyId()` antes de qualquer query.
- **DSAR endpoints** gated em `dsar:execute` (super_admin only).
- **Settings UI** gated em `settings:manage`.

### 1.4 Input validation

- **Zod schemas** em 100% das Server Actions (arquivos `*-schemas.ts`).
- **Prisma ORM** parametrizado — sem `$queryRawUnsafe` no codebase.
- **ESLint rule** `nexus-crm/no-direct-consent-write` força uso de `recordConsent`.
- **ESLint rule** `no-console-in-src` força uso de `@/lib/logger`.

### 1.5 Output / Browser hardening (Fase 12.4)

- **Content-Security-Policy** `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
- **X-Frame-Options** `DENY` (clickjacking).
- **X-Content-Type-Options** `nosniff`.
- **Referrer-Policy** `strict-origin-when-cross-origin`.
- **Permissions-Policy** desliga camera/microphone/geolocation/browsing-topics.

### 1.6 Data at rest

- **AES-256-GCM** em tokens OAuth/IMAP (`src/lib/crypto/aes-gcm.ts`) com
  derivação scrypt de `ENCRYPTION_KEY` (64 hex).
- **HMAC SHA-256** em unsubscribe tokens (stateless TTL 90d, requer
  `UNSUBSCRIBE_TOKEN_SECRET` ≥ 32 chars).
- **Backup** pg_dump + age encryption + SHA-256 checksum (`scripts/ops/backup-postgres.sh`).

### 1.7 Observability

- **pino** logger com PII redactors em `src/lib/logger.ts`.
- **x-request-id** propagado via middleware.
- **Audit log** fire-and-forget em operações sensíveis.

### 1.8 Supply chain (Fase 12.4)

- **npm audit** no CI: critical bloqueia PR, high emite warning.
- **gitleaks** no CI (PR + push) com allowlist para docs/seeds/fixtures.
- **`npm ci`** (não install) em builds determinísticos.
- **GHCR** imagens com tag por commit SHA.

### 1.9 Compliance

- **Consent LGPD** idempotente (`src/lib/consent/recordConsent`).
- **DSAR endpoints** export/revoke/erase (Fase 12.0).
- **consent_logs** imutáveis preservados mesmo após erase.
- **Doc canônico LGPD** em `docs/lgpd.md`.

---

## 2. Controles pendentes

| Controle | Owner tentativo | Prazo | Motivo |
|---|---|---|---|
| Sentry DSN + alerts | backend | Q2 2026 | Fase 1c tem spec própria |
| OpenTelemetry real | backend | Q2 2026 | Fase 1c tem spec própria |
| MFA (TOTP) | backend | Q3 2026 | Pós-launch |
| CSP nonce-based | frontend | Q2 2026 | Follow-up 12.4b |
| WAF / Cloudflare | infra | Q3 2026 | Pós-primeiro incidente |
| Penetration testing externo | mgmt | Q3 2026 | Contratar |
| Bug bounty | mgmt | Q4 2026 | Pós-launch estável |
| Atualizar deps high CVE | backend | Q2 2026 | next DoS, nodemailer, rollup, hono |
| Audit log retention policy | backend | Q2 2026 | Definir TTL + compliance LGPD |

### 2.1 Vulnerabilidades high conhecidas (npm audit 2026-04-14)

4 CVEs high presentes em prod, não-bloqueantes (warn only no CI):

| Advisory | Package | Via | Fix |
|---|---|---|---|
| [GHSA-q4gf-8mx6-v5v3](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3) | next | direto | bump next@16.2.3 |
| [GHSA-mm7p-fcc7-pg87](https://github.com/advisories/GHSA-mm7p-fcc7-pg87) | nodemailer | transitivo | atualizar dep raiz |
| [GHSA-mw96-cpmx-2vgc](https://github.com/advisories/GHSA-mw96-cpmx-2vgc) | rollup | @sentry/nextjs | bump sentry@10 |
| [GHSA-92pp-h63x-v22m](https://github.com/advisories/GHSA-92pp-h63x-v22m) | @hono/node-server | @prisma/dev | Prisma 7 upgrade |

Plano: abrir PR por package em Q2 2026 após verificar compat matrix.

---

## 3. Modelo de ameaças (STRIDE adaptado)

| Ameaça | Vetor típico | Mitigação ativa | Status |
|---|---|---|---|
| **SQL Injection** | user input → query | Prisma ORM + Zod + ESLint no-queryRawUnsafe | ✅ |
| **XSS refletida** | user input → DOM | CSP `script-src 'self'` + React auto-escape | ✅ (com unsafe-inline MVP) |
| **XSS armazenada** | user input → DB → DOM | React auto-escape; sanitizer de rich-text | 🟡 rich-text sanitizer TODO |
| **CSRF** | cross-origin POST | NextAuth CSRF token + SameSite cookies | ✅ |
| **Clickjacking** | iframe injection | X-Frame-Options DENY + `frame-ancestors 'none'` | ✅ |
| **Session fixation** | pre-login session → priv | JWT rotation no signIn | ✅ |
| **Credential stuffing** | bulk login attempts | Rate limit 3 tiers | ✅ |
| **Privilege escalation** | action sem auth check | RBAC `requirePermission` per Server Action | ✅ |
| **Cross-tenant leak** | manipular IDs em request | `requireActiveCompanyId` em queries | ✅ (Frente 17) |
| **Secret em repo** | git push com token | gitleaks CI + pre-commit hook (TODO) | 🟡 CI ok, pre-commit TODO |
| **SSRF** | user URL → fetch server | fetch controlado; sem user-supplied URL endpoints | ✅ |
| **Mass assignment** | extra fields em body | Zod strict schemas | ✅ |
| **Replay attack** | reuse token | unsubscribe HMAC + TTL 90d; email token TTL 1h | ✅ |
| **DoS via request** | volume | Rate limit + Next built-in body-size-limit | 🟡 sem WAF |
| **DoS via dep CVE** | exploit conhecido | npm audit CI | 🟡 high tracked 2.1 |

---

## 4. Runbook de incidente

### 4.1 Credencial / secret vazado

1. **Rotacionar imediatamente** no provedor (Google/Microsoft/Resend/Portainer/GitHub).
2. Se `NEXTAUTH_SECRET`: gerar novo (`openssl rand -base64 32`), atualizar em
   Portainer env, **force logout global** (rollout do app — todas as sessões
   JWT existentes ficam inválidas automaticamente).
3. Se `ENCRYPTION_KEY` ou `UNSUBSCRIBE_TOKEN_SECRET`: processo mais delicado —
   dados encrypted precisam ser re-criptografados. Abrir issue de migration.
4. `git filter-repo` ou commit removendo segredo + force-push (LEI ABSOLUTA:
   validar com usuário antes de force-push em main).
5. Registrar no histórico (§6).

### 4.2 XSS explorada

1. Identificar campo de entrada (logs + user report).
2. Patch: adicionar sanitizer (DOMPurify ou similar) no campo afetado.
3. Tighten CSP: se possível, mover para `script-src 'self' 'nonce-<per-request>'`
   (segue Fase 12.4b).
4. Audit log review: queries de exploit + scope de impacto.
5. Registrar no histórico.

### 4.3 Cross-tenant leak

1. **Parar tráfego** via rollback: `docker service update --rollback nexus-crm-krayin_app`.
2. Identificar rows vazadas: grep audit-log por actor.companyId ≠ subject.companyId.
3. DSAR-like cleanup se rows vazaram para terceiros.
4. Notificar tenant afetado (compliance LGPD 72h).
5. Patch + rollout + registrar no histórico.

### 4.4 Rate limit burlado (bruteforce em andamento)

1. Logs: `grep rate_limit_exceeded | awk '{print $ip}' | sort | uniq -c | sort -rn`.
2. Bloquear IP no firewall Portainer ou reverse proxy.
3. Aumentar tier-3 global temporariamente.
4. Audit users tentados + resetar passwords se necessário.

### 4.5 Deploy quebrado em prod (500)

Seguir **LEI ABSOLUTA #1** (`CLAUDE.md` §1):

1. Puxar logs do container via Portainer API (comando canônico em CLAUDE.md).
2. NÃO commitar fix especulativo antes de identificar causa nos logs.
3. Se causa não clara em 2 tentativas, rollback: `docker service rollback`.

### 4.6 DB corrompido

1. Stop writes: `docker service scale nexus-crm-krayin_app=0`.
2. `docker exec -it nexus-crm-krayin_db pg_dump -U nexus nexus_crm_krayin > /tmp/current.sql` (pre-corruption snapshot).
3. Restore último backup `age` → `pg_restore`.
4. Replay audit-log se houver perda de dados.
5. Scale app de volta.

---

## 5. Cadência operacional

- **Diário:** monitorar `/api/health` e `/api/ready` via uptime.
- **Semanal (sex):** rodar `npm audit --audit-level=low` local, abrir PR de updates.
- **Mensal:** revisar logs de rate-limit + audit-log; executar backup drill.
- **Semestral:** revisar este doc + security-audit-checklist completo.
- **Anual:** pentest externo (quando contratado).

---

## 6. Histórico de auditoria

| Data | Auditor | Achados | Status |
|---|---|---|---|
| 2026-04-14 | Claude Opus 4.6 (autônomo) | ausência de security headers; sem npm audit/gitleaks CI; doc security canônico ausente; 4 CVEs high em deps | resolvido (headers+CI); CVEs tracked §2.1 |

---

## 7. Referências

- OWASP Top 10 2021: https://owasp.org/Top10/
- Next.js security headers: https://nextjs.org/docs/advanced-features/security-headers
- CSP reference: https://content-security-policy.com/
- NextAuth security: https://authjs.dev/concepts/security
- LEI ABSOLUTA #1 (debug): `CLAUDE.md` §1
