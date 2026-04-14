# Fase 12.4 — Security Audit

**Data:** 2026-04-14
**Status:** spec v3
**Depends on:** prod estável (login 200 após fix dual React + lazy Resend)

## 1. Contexto e motivação

O CRM já está em produção atendendo usuários internos. As camadas anteriores
entregaram:

- RBAC 21+ permissions × 5 roles (Fase 1c)
- Consent LGPD idempotente (Fase 1b)
- Tenant scoping cross-tenant safe (Frente 17)
- Rate limit em login (auth-helpers)
- DSAR endpoints (Fase 12.0)
- Criptografia AES-256-GCM em mailboxes (Fase 7a)

Ainda assim, faltam três camadas defensivas básicas que todo app SaaS deve ter
**antes** de abrir para uso externo:

1. **Security headers HTTP** (CSP, HSTS, X-Frame-Options, etc.) — mitigação
   de XSS, clickjacking, MIME sniffing, leak de referrer.
2. **Scan automatizado de vulnerabilidades em dependências** (`npm audit`) no
   CI — bloquear merge quando há CVE high/critical.
3. **Secret scanning** (gitleaks) no CI — prevenir commit acidental de tokens,
   chaves, senhas.

Além disso, precisamos produzir um **Security Checklist** (`docs/ops/security.md`)
que documenta o que foi feito, o que falta, e serve de referência para futuros
auditorias.

## 2. Objetivo

Fechar o gap defensivo descrito acima sem alterar comportamento funcional,
mantendo a app utilizável em dev e prod.

Critérios de sucesso:

- `curl -I https://crm2.nexusai360.com/` devolve CSP, HSTS, XFO, XCTO,
  Referrer-Policy, Permissions-Policy.
- CI falha quando PR introduz dependência com CVE high/critical.
- CI falha quando PR introduz secret (chave AWS/OpenAI/etc.) em qualquer arquivo.
- Doc `docs/ops/security.md` cobre (a) ameaças conhecidas e como mitigamos,
  (b) itens pendentes com owner+prazo, (c) runbook de resposta a incidente.

Fora de escopo desta fase:

- Penetration testing externo (contratar empresa).
- WAF/Cloudflare rules (não temos CF, infra é Portainer direto).
- Bug bounty program.
- CSP nonce-based (usar hashes/unsafe-inline no MVP).
- Sentry wiring real (Fase 1c pendente, tem spec própria).

## 3. Arquitetura

### 3.1 Security Headers

Adicionados via `headers()` do `next.config.ts` para rotas públicas e via
middleware para rotas API (evita middleware response.ts próprio).

Headers propostos:

| Header | Valor | Justificativa |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Força HTTPS por 2 anos |
| `X-Frame-Options` | `DENY` | Previne clickjacking (app nunca embute em iframe) |
| `X-Content-Type-Options` | `nosniff` | Previne MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leaka origem apenas same-origin |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Desliga APIs invasivas (inclui Topics API, sucessor do FLoC) |
| `Content-Security-Policy` | vide §3.2 | Mitigação XSS |

CSP é o mais delicado. Política inicial permissiva para não quebrar. Next
`next/font/google` é self-hosted (download em build-time), então não precisa
allowlistar `fonts.googleapis.com`. O app é single-origin (`crm2.nexusai360.com`),
então `connect-src 'self'` já cobre SSE e server actions:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
img-src 'self' data: blob: https:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

`unsafe-inline`/`unsafe-eval` ainda permitidos (Next 16 em dev injeta inline
chunks, turbopack eval). Aperto via nonce fica para follow-up — meta do MVP
é ligar CSP sem quebrar nada.

**Onde os headers são aplicados:** via `async headers()` do `next.config.ts`,
com matcher `source: "/(.*)"` — cobre todas as rotas (SSR + API + static).
Middleware não precisa mudar; o existente (`x-request-id` + auth) permanece.

### 3.2 npm audit no CI

Novo job `security` no workflow existente `.github/workflows/build.yml` (ou
arquivo próprio). Comando:

```
npm audit --audit-level=high --omit=dev
```

Exit code não-zero → job falha → PR blocked. Allowlist via `.npmauditrc` para
casos documentados (decisão consciente que não dá para atualizar agora).

**Cadência de revisão:** toda sexta-feira, rodar `npm audit --audit-level=low`
manualmente e abrir PRs atualizando deps. `.npmauditrc` fica como último
recurso — prefer sempre patch da dep quando possível.

### 3.3 Gitleaks

Novo job `gitleaks` usando action oficial `gitleaks/gitleaks-action@v2`. Config
em `.gitleaks.toml` com ruleset default + allowlist para:

- Arquivos `*.md` e `docs/` (falsos positivos de exemplos)
- `prisma/seed*.ts` (passwords hardcoded de ambiente de teste/demo)
- Pasta `tests/e2e/fixtures/` (senhas de test users)

Escopo do scan: **só commits novos** (`--no-git` dispensa scan histórico do
repo). Scan de histórico completo roda apenas manualmente fora do CI para não
travar builds legítimos por commits antigos já descartados.

Roda em PR + push main. Falha → investigar + remover commit/segredo via
rotação imediata no provedor + nova chave.

### 3.4 Security Checklist doc

Estrutura de `docs/ops/security.md`:

1. **Controles ativos** — lista do que está em prod hoje (HTTPS, rate-limit,
   RBAC, consent, CSP headers, npm audit CI, gitleaks CI, encryption AES-GCM,
   auth stateless JWT, tenant scoping).
2. **Controles pendentes** — Sentry (alerts), WAF, pentest, bug bounty,
   CSP nonce, MFA, audit log retention policy.
3. **Modelo de ameaças** — quem, o quê, impacto, mitigação atual.
4. **Runbook de incidente** — passos a executar se credencial vazar, se XSS
   for explorada, se rate-limit for burlado.
5. **Histórico de auditoria** — tabela de datas + achados + status.

## 4. Componentes afetados

| Componente | Mudança |
|---|---|
| `next.config.ts` | `headers()` async exportando headers globais |
| `.github/workflows/security.yml` | novo workflow: npm audit + gitleaks |
| `.gitleaks.toml` | nova config |
| `.npmauditrc` | placeholder (vazio — allowlist conforme surgir) |
| `docs/ops/security.md` | novo doc |

Nada de runtime behavior muda — zero risco funcional. O único risco é CSP
quebrar algum inline script em dev; mitigado por `unsafe-inline` no MVP.

## 5. Testes

- **Manual smoke**: `curl -sI https://crm2.nexusai360.com/` mostra todos os
  headers esperados.
- **Manual browser**: abrir console e confirmar ausência de CSP violations.
- **CI**: rodar `npm audit --audit-level=high --omit=dev` local e confirmar
  0 vulns high/critical. Se houver, atualizar ou adicionar exceção documentada.
- **CI**: rodar gitleaks detect local (`gitleaks detect --no-git`) e confirmar
  0 findings.

Unit tests não se aplicam — tudo é config infra.

## 6. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| CSP quebra inline script em alguma página | média | `unsafe-inline` permitido no MVP |
| npm audit bloqueia PR por vuln transitive não atualizável | média | Allowlist documentada em `.npmauditrc` |
| Gitleaks falso positivo em doc/example | alta | Allowlist para `*.md` e `docs/` |
| HSTS preload difícil de reverter | baixa | Já estamos sob HTTPS há meses; domínio dedicado |

## 7. Entregáveis da fase

1. Headers ativos em prod (`curl -I` confirma).
2. Workflow `security.yml` no CI, rodando em push+PR.
3. `docs/ops/security.md` committed.
4. Tag `phase-12-4-deployed` ao final.

## 8. Não-objetivos explícitos

- Sentry (Fase 1c tem spec própria).
- Pentest externo.
- WAF/rules Cloudflare.
- Nonce-based CSP.
- Atualizar deps major (não é security update, é upgrade).
