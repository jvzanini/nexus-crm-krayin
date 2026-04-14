# Security Audit Checklist — Nexus CRM

**Versão:** 1.0 (Fase 12.4)
**Última revisão:** 2026-04-14
**Próxima revisão:** pré-launch + a cada 6 meses

---

## OWASP Top 10 2021 (A01–A10)

### A01 — Broken Access Control

- [ ] RBAC matrix revisada: `src/lib/rbac/permissions.ts` (21+ permissions × 5 roles) — Evidências: (TODO)
- [ ] Todas as Server Actions com `requirePermission` ou `userHasPermission` — Evidências: (TODO)
- [ ] Tenant scope validado em actions que tocam dados tenant-specific (leads, contacts, opportunities) — Evidências: (TODO)
- [ ] Rate limit em rotas públicas (login, unsubscribe, tracking pixel) — Evidências: (TODO — implementar em middleware Fase 12.4)
- [ ] Rota `/api/v1/subjects/:type/:id/*` gated em `dsar:execute` — Evidências: (TODO Fase 12.0)

### A02 — Cryptographic Failures

- [ ] `ENCRYPTION_KEY` (64 hex chars) configurado em produção via Portainer env vars — Evidências: (TODO)
- [ ] Tokens OAuth/IMAP encrypted-at-rest via `src/lib/crypto/aes-gcm` — Evidências: (TODO)
- [ ] HMAC SHA-256 para unsubscribe tokens (`UNSUBSCRIBE_TOKEN_SECRET`) — Evidências: (TODO)
- [ ] HTTPS enforced em produção (Portainer + Caddy reverse proxy) — Evidências: (TODO)
- [ ] Passwords com bcrypt cost=12 — Evidências: (TODO)

### A03 — Injection

- [ ] Prisma ORM usado em todas as queries — sem `$queryRawUnsafe` no codebase — Evidências: (TODO — rodar `grep -r queryRawUnsafe src/`)
- [ ] Zod validation em TODAS Server Actions + route handlers — Evidências: (TODO)
- [ ] ESLint rule `nexus-crm/no-direct-consent-write` ativa — Evidências: (TODO)
- [ ] HTML sanitizado nos emails antes de send (Fase 7c) — Evidências: (TODO Fase 7c)

### A04 — Insecure Design

- [ ] Rate limit em login (TODO 12.4 — implementar via middleware `src/middleware.ts`)
- [ ] Session timeout 7 dias (NextAuth v5 JWT `maxAge`) — Evidências: (TODO)
- [ ] Pattern fire-and-forget em audit-log e notifications (sem bloquear response) — Evidências: (TODO)
- [ ] DSAR erase preserva IDs + FK integrity, apenas anonimiza PII — Evidências: (TODO Fase 12.0)

### A05 — Security Misconfiguration

- [ ] CSP header revisado em `next.config.ts` ou middleware — Evidências: (TODO)
- [ ] CORS origin allowlist configurada — Evidências: (TODO)
- [ ] `X-Frame-Options: DENY` presente nas headers — Evidências: (TODO)
- [ ] `X-Content-Type-Options: nosniff` presente — Evidências: (TODO)
- [ ] `Strict-Transport-Security` (HSTS) configurado no reverse proxy — Evidências: (TODO)
- [ ] Variáveis de ambiente sensíveis nunca em `NEXT_PUBLIC_*` — Evidências: (TODO)

### A06 — Vulnerable and Outdated Components

- [ ] `npm audit --audit-level=high` verde (zero high/critical) — Evidências: (TODO — rodar antes do launch)
- [ ] `package-lock.json` comitado e atualizado — Evidências: presente no repo
- [ ] Dependabot / renovate configurado para alertas de segurança — Evidências: (TODO)
- [ ] Docker base image atualizada (`node:20-alpine`) — Evidências: (TODO — verificar Dockerfile)

### A07 — Identification and Authentication Failures

- [ ] NextAuth v5 JWT stateless com `trustHost: true` — Evidências: `src/lib/auth.ts` (TODO link commit)
- [ ] Password reset token expira em 1h — Evidências: `src/lib/actions/password-reset.ts` (TODO)
- [ ] Sem account enumeration em tela de login (mensagem genérica) — Evidências: (TODO)
- [ ] 2FA: TODO pós-Fase 12 (roadmap pós-launch)
- [ ] Sessão invalidada no logout (JWT blacklist ou cookie clear) — Evidências: (TODO)

### A08 — Software and Data Integrity Failures

- [ ] Deploy via GHCR com imagens verificadas (`ghcr.io/jvzanini/nexus-crm-krayin`) — Evidências: `.github/workflows/build.yml`
- [ ] Backups encrypted com `age` + SHA-256 checksums — Evidências: `scripts/ops/backup-postgres.sh`
- [ ] Webhook signatures validadas (TODO Fase 11b)
- [ ] `npm ci` (não `npm install`) em CI para builds determinísticos — Evidências: `build.yml`

### A09 — Security Logging and Monitoring Failures

- [ ] pino logger com PII redactors configurados em `src/lib/logger.ts` — Evidências: (TODO)
- [ ] Sentry DSN configurado para captura de erros em produção (`SENTRY_DSN` env) — Evidências: (TODO Fase 1c)
- [ ] Audit log registrado em operações sensíveis (`src/lib/audit-log`) — Evidências: (TODO link módulo)
- [ ] Request ID (`x-request-id`) propagado entre logs — Evidências: (TODO)
- [ ] Alertas configurados para erros 5xx acima de threshold — Evidências: (TODO Sentry alerts)

### A10 — Server-Side Request Forgery (SSRF)

- [ ] Sem `fetch` com URLs controladas por usuário — Evidências: (TODO — revisar route handlers)
- [ ] Email attachment upload com mime allowlist server-side — Evidências: (TODO Fase 7c)
- [ ] Integrations OAuth redirect URLs validadas contra allowlist — Evidências: (TODO)

---

## CRM-specific

### LGPD Compliance

- [ ] DSAR endpoints funcionais: export / revoke / erase (Fase 12.0) — Evidências: (TODO Fase 12.0)
- [ ] `consent_logs` preservados mesmo após erase (evidência de compliance) — Evidências: (TODO)
- [ ] Pixel tracking gated em `canTrackOpen` (Fase 7c) — Evidências: (TODO Fase 7c)
- [ ] `ConsentSource` inclui `"dsar"` — Evidências: (TODO Fase 12.0)
- [ ] Doc `docs/lgpd.md` atualizado com endpoints DSAR — Evidências: `docs/lgpd.md`

### Operacional

- [ ] Secrets em Portainer env vars — nunca comitados no repo — Evidências: `.gitignore` inclui `.env*`
- [ ] `.env.production` gitignored — Evidências: (TODO — verificar `.gitignore`)
- [ ] Backup drill mensal executado com sucesso (Fase 12.3) — Evidências: `.github/workflows/backup-drill.yml`
- [ ] Runbook on-call disponível e revisado (Fase 12.5) — Evidências: `docs/ops/runbook.md`

---

## Scanners

- [ ] `gitleaks detect --source=. --log-opts="--since=90.days.ago"` — zero leaks — Evidências: (TODO — rodar antes do launch)
- [ ] `npm audit --audit-level=high` — zero high/critical — Evidências: (TODO)
- [ ] Lighthouse CI budgets verdes (LCP<2.5s, CLS<0.1, TBT<300ms, TTI<3s, JS<170KB gz) — Evidências: `.github/workflows/lhci.yml` (Fase 12.1)

---

## Procedimento de revisão

1. Rodar scanners automatizados (`gitleaks`, `npm audit`, Lighthouse CI).
2. Revisar manualmente cada item da lista, preenchendo evidências com link para commit/PR/arquivo.
3. Items marcados `(TODO)` devem ser resolvidos ou justificados como aceite de risco antes do go-live.
4. Registrar resultado no PR de launch com sign-off do responsável técnico.
