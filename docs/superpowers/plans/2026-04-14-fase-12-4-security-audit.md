# Plan — Fase 12.4 Security Audit

**Spec:** `docs/superpowers/specs/2026-04-14-fase-12-4-security-audit-design.md`
**Branch:** `main` (commits diretos, sem PR — fase de infra, baixo risco)
**Tag final:** `phase-12-4-deployed`

## Visão geral

5 tasks independentes-ou-quase, todas pequenas. Sem mudança de runtime — só
config e docs. Commits atômicos por task.

| Task | Arquivos | Tamanho |
|---|---|---|
| T1 Security headers | `next.config.ts` | S |
| T2 npm audit CI | `.github/workflows/security.yml` | S |
| T3 Gitleaks CI | mesmo workflow + `.gitleaks.toml` | S |
| T4 Doc security.md | `docs/ops/security.md` | M |
| T5 Validação prod + tag | — | S |

## T1 — Security headers no next.config

**Objetivo:** `curl -I https://crm2.nexusai360.com/` retorna HSTS, XFO, XCTO,
Referrer-Policy, Permissions-Policy, CSP.

**Arquivo único:** `next.config.ts`.

Adicionar function `async headers()` dentro do `nextConfig` retornando um array
com um entry:

```ts
{
  source: "/(.*)",
  headers: [
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
    { key: "Content-Security-Policy", value: CSP_VALUE },
  ],
}
```

`CSP_VALUE` é const do topo do arquivo:

```ts
const CSP_VALUE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");
```

**Validação local (antes de push):**

1. `npm run build` não pode quebrar.
2. `node .next/standalone/server.js` + `curl -sI http://127.0.0.1:3002/login`
   mostra headers.
3. Abrir `/login` no navegador e confirmar no DevTools Network que headers
   estão presentes e página renderiza sem CSP violations.

**Commit:** `feat(security): headers HTTP globais (HSTS/CSP/XFO/...) — Fase 12.4 T1`

## T2 — npm audit workflow

**Arquivo novo:** `.github/workflows/security.yml`.

```yaml
name: Security
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: npm audit (critical blocks PR)
        run: npm audit --audit-level=critical --omit=dev
      - name: npm audit (high warning only)
        run: npm audit --audit-level=high --omit=dev || echo "::warning::high-severity vulns present, tracked in docs/ops/security.md"
```

**Sem allowlist file** — `npm` não tem suporte nativo a `.npmauditrc`.
Controle via `--audit-level=critical` (bloqueia apenas critical) + warning
para high. CVEs high atuais (4 conhecidas: next DoS, nodemailer cmd injection,
rollup via Sentry, @hono/node-server via Prisma) ficam documentadas em
`docs/ops/security.md` §2 com prazo de correção Q2 2026.

**Validação local:**

1. `npm audit --audit-level=high --omit=dev` local passa.
2. Se falhar, abrir issue documentando CVE + plano de atualização, e rodar
   `npm audit fix` antes de commitar.

**Commit:** `ci(security): npm audit em PR+push — Fase 12.4 T2`

## T3 — Gitleaks workflow

Mesmo arquivo do T2, adicionar segundo job:

```yaml
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_CONFIG: .gitleaks.toml
```

**Arquivo novo:** `.gitleaks.toml` com ruleset default + allowlist:

```toml
[extend]
useDefault = true

[allowlist]
description = "Docs, seeds e fixtures de teste"
paths = [
  '''docs/''',
  '''(.+\.md)$''',
  '''prisma/seed.*\.ts''',
  '''tests/e2e/fixtures/.*''',
]
```

**Validação local:**

1. `gitleaks detect --config .gitleaks.toml --no-git` sem findings.
2. Se houver findings legítimos, rotacionar credencial e remover do arquivo.

**Commit:** `ci(security): gitleaks scan em PR+push — Fase 12.4 T3`

## T4 — Doc `docs/ops/security.md`

**Arquivo novo.** Estrutura da §3.4 da spec.

Seções obrigatórias:

1. **Controles ativos** (lista bullet do que está em prod). Incluir:
   HTTPS+HSTS, auth JWT stateless, rate limit login (3 tiers),
   RBAC 21+ perms × 5 roles, tenant scoping, consent LGPD, DSAR endpoints,
   AES-256-GCM em mailboxes, CSP headers, npm audit CI, gitleaks CI,
   middleware x-request-id.
2. **Controles pendentes** (com owner+prazo tentativo):
   Sentry/OTel wiring (Fase 1c), MFA (backlog), CSP nonce (follow-up 12.4b),
   WAF/Cloudflare (backlog), pentest externo (Q3), bug bounty (Q4).
3. **Modelo de ameaças** (tabela):
   - SQL injection → Prisma parametrizado ✓
   - XSS refletida → CSP + React auto-escape ✓
   - XSS armazenada → sanitização em rich-text fields (TODO)
   - CSRF → SameSite=Lax + NextAuth CSRF token ✓
   - Clickjacking → X-Frame-Options DENY ✓
   - Session fixation → NextAuth rota session rotation ✓
   - Credential stuffing → rate limit 3 tiers ✓
   - Privilege escalation → RBAC per-action ✓
   - Cross-tenant leak → tenant scoping Frente 17 ✓
   - Secret em repo → gitleaks CI ✓
4. **Runbook de incidente**:
   - Credencial vazada: rotacionar no provedor, invalidar sessions (revogar
     NEXTAUTH_SECRET), force logout global, audit log review.
   - XSS explorada: identificar campo, patch sanitizer, CSP report-only
     tightening, audit.
   - Tenant leak: rollback imediato, identificar rows, DSAR-like cleanup.
   - Rate limit burlado: aumentar tier, bloquear IP em firewall Portainer.
5. **Histórico de auditoria**: tabela com header `| Data | Auditor | Achados | Status |`
   com primeira linha desta fase: `| 2026-04-14 | Claude Opus 4.6 | headers ausentes, scans ausentes | resolvido |`.

**Commit:** `docs(security): runbook + threat model + checklist — Fase 12.4 T4`

## T5 — Validação prod + tag

**Checklist:**

1. `git push origin main` (tudo junto se T1-T4 foram commits atômicos).
2. Aguardar CI build+deploy completar (~4min).
3. `curl -sI https://crm2.nexusai360.com/login | grep -iE "strict-transport|content-security|x-frame|x-content-type|referrer|permissions-policy"` → 6 linhas.
4. `curl -s -o /dev/null -w "%{http_code}" https://crm2.nexusai360.com/login` → 200.
5. `gh run list --workflow=security.yml --limit 1` → success.
6. `git tag phase-12-4-deployed && git push origin phase-12-4-deployed`.

## Ordem de execução

Sequencial porque commits são pequenos e dependências ordenadas (T1 não depende
de T2, mas é melhor validar T1 local antes de empilhar). Todas as tasks são
independentes de Server Actions, schema, ou domain logic — risco de regressão
funcional é baixo.

T1 → T2 → T3 → T4 → push único → T5 (validação + tag).

## Rollback

Se CSP quebrar algo em prod: revert commit T1, push, próximo deploy reverte.
Headers ausentes não bloqueiam app. Gitleaks/npm audit falhas não afetam runtime.
