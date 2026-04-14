# Spec: Fase 12 — Hardening + Deploy Final

**Data:** 2026-04-15
**Versão:** v3 (inline 2 reviews)
**Depende de:** todas as fases anteriores. **Partes independentes** executáveis desde já (DSAR, Lighthouse CI, E2E golden paths) mesmo com Fases 2/4/5/7c/9.1 pendentes.
**Gate para:** go-live produção.

---

## Changelog

### v2 → v3 (Review 2 profunda)
- **Dividido em 12.0–12.5** com aceite independente:
  - **12.0 — DSAR (LGPD Art. 18):** endpoints export/delete/anonimize + E2E teste isolado. Não depende de fases em lock.
  - **12.1 — Performance budgets:** `@lhci/cli` em CI + budgets por rota. Não depende.
  - **12.2 — E2E golden paths:** Playwright spec por role (admin/manager/seller/viewer). Depende das fases implementadas (o que está deployed); pula módulos não deployados.
  - **12.3 — Backup drill completo:** executa `scripts/ops/restore-drill.sh` em staging com backup real. Depende só de Fase 1c.2 (✅).
  - **12.4 — Security audit:** checklist OWASP Top 10 + dependency audit (`npm audit`) + secret scan (gitleaks) + CORS/CSP review.
  - **12.5 — Docs Portainer finais + runbook on-call:** docs/ops + go-live playbook.
- **DSAR tag Postgres não precisa:** registros podem ser anonimizados via `UPDATE users SET email=..., name=...` com sufixo de timestamp. PII mantida apenas em `consent_logs` (preservado por compliance) com `reason="erased_by_dsar"`.
- **Lighthouse budgets** exatos por rota (3 representativas em 12.1): `/`, `/dashboard`, `/leads`. Threshold: LCP p95 < 2.5s @ 3G fast; CLS < 0.1; TBT < 300ms; bundle JS < 170KB gz.
- **Golden path multi-tenant:** seed cria 2 companies + 2 admins + 2 sellers. Teste valida cross-tenant isolation em leads/campaigns/activities.

### v1 → v2 (Review 1)
- Escopo separado por sub-fase para permitir ship incremental.
- Audit = checklist documentado, não tooling novo (scanners open-source já disponíveis).

---

## 1. Objetivo

1. **LGPD art. 18 compliance:** usuário pode exercer direitos de acesso, correção, exclusão, anonimização via endpoints auditáveis.
2. **Quality gates:** Lighthouse budgets + E2E golden paths rodam em CI antes de merge.
3. **Segurança:** checklist de hardening OWASP + dependency/secret scans.
4. **Operacional:** runbook de incidents + backup drill documentado + deploy playbook.

## 2. Escopo

### 2.1. DSAR (12.0)

#### 2.1.1. Endpoints REST

Protegidos com RBAC `dsar:execute` (nova permission — super_admin e company_admin apenas):

- `GET /api/v1/subjects/:type/:id/export` — retorna JSON estruturado com todos os dados do subject (lead/contact/opportunity): campos + activities + emails + consent_logs + audit_logs relacionados. Content-type `application/json`, `Content-Disposition: attachment; filename="subject-<id>-export.json"`.
- `POST /api/v1/subjects/:type/:id/consent/revoke` — body `{reason?}`. Revoga `consentMarketing` e `consentTracking`. Grava `consent_logs` com `source='dsar'` novo valor. Não anonimiza dados.
- `POST /api/v1/subjects/:type/:id/erase` — body `{reason?}`. Anonimiza PII:
  - Lead/Contact: `email = "erased-<timestamp>-<random>@anon.local"`, `name = "[DSAR ERASED]"`, `phone = null`, `notes = null`, `description = null`, IP masks = null.
  - Activities do subject: `description = null`, `location = null` (title preserva tipo sem PII).
  - Preserva: `consent_logs` (evidência de compliance) — adiciona log novo `source='dsar'`, `reason='erased_by_dsar'`.
  - Audit log: registra ação `'subject.erased'`.

#### 2.1.2. ConsentSource + AuditLog

Amplie `ConsentSource` com `"dsar"`.

Audit log entries: `subject.exported | subject.consent_revoked | subject.erased`.

#### 2.1.3. RBAC

Adicionar permission `dsar:execute`. Distribuição:
- super_admin: yes.
- admin: yes (do seu tenant).
- manager, seller, viewer: no.

### 2.2. Lighthouse CI (12.1)

`.lighthouserc.json`:
```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", "http://localhost:3000/dashboard", "http://localhost:3000/leads"],
      "numberOfRuns": 3,
      "settings": { "preset": "desktop", "throttlingMethod": "simulate" }
    },
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }],
        "interactive": ["error", { "maxNumericValue": 3000 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 170000 }]
      }
    }
  }
}
```

Workflow `.github/workflows/lhci.yml` roda no PR com auth test-user + rotas autenticadas.

### 2.3. E2E golden paths (12.2)

`tests/e2e/golden-paths/` com specs por role:
- `admin-golden-path.spec.ts` — CRUD completo nas 10+ entidades deployed.
- `manager-golden-path.spec.ts` — CRUD onde `*:manage`, block onde não.
- `seller-golden-path.spec.ts` — create/view onde pode, block delete.
- `viewer-golden-path.spec.ts` — apenas view.

Cross-tenant:
- `cross-tenant-isolation.spec.ts` — admin do tenant A loga, tenta acessar URL `/leads/<id-do-tenant-B>` → 404.

### 2.4. Backup drill (12.3)

- Schedule mensal `.github/workflows/backup-drill.yml` — roda `scripts/ops/restore-drill.sh` com secrets de staging.
- Output arquivado como artifact.
- Sucesso = pass CI; fail = Issue auto-aberta.

### 2.5. Security audit (12.4)

Checklist `docs/ops/security-audit-checklist.md`:
- OWASP Top 10 2021 review.
- `npm audit --audit-level=high` verde.
- `gitleaks` scan em commits últimos 90 dias.
- CSP header review (CSP middleware).
- Rate limit review em rotas públicas (login, unsubscribe, tracking pixel).
- Input validation coverage em Server Actions.
- Session timeout review.
- Password policy review.

Cada item = entrada na checklist com evidência (link para commit/PR/doc).

### 2.6. Runbook (12.5)

`docs/ops/runbook.md`:
- Deploy procedure (Portainer rollout + migration apply via psql).
- Rollback procedure (tag anterior + migration down).
- On-call triage: como diagnosticar "app caiu", "worker não processa", "migration falhou".
- Contacts: quem chamar para cada categoria (platform, DB, provider email, etc.).

### 2.7. Fora de escopo

- Re-auditar LGPD compliance (feito pela Fase 1b + legal review externa).
- Rewrite de infraestrutura (Kubernetes/Vercel migration — Fase futura se decidido).
- Feature additions — só bug fixes durante hardening.

## 3. Aceite por sub-fase

### 12.0 DSAR
- 3 endpoints + tests integration.
- Permission `dsar:execute` + role matrix.
- Audit log registros em cada ação.
- `ConsentSource` extended.
- Doc `docs/lgpd.md` atualizado com endpoints.

### 12.1 Lighthouse
- `.lighthouserc.json` commitado.
- Workflow CI executa + falha build se budget estourado.
- 3 rotas testadas.

### 12.2 E2E
- 5 specs (4 roles + cross-tenant) verdes.
- Tempo total suite < 10 min.

### 12.3 Backup drill
- 1 execução sucesso em staging + artifact CI.

### 12.4 Security audit
- Checklist com 100% evidências preenchidas.
- `npm audit --audit-level=high` verde.

### 12.5 Runbook
- Doc commitado + review manual.

## 4. Riscos

| Risco | Sev | Mitigação |
|-------|-----|-----------|
| DSAR erase quebra integridade referencial | Alto | Preserva IDs + consent_logs; apenas PII é anonimizada. FK integrity mantida. |
| Lighthouse budget muito restritivo → PRs bloqueados | Médio | Budgets calibrados em staging; ajuste via PR focado se justificado. |
| E2E golden path suite lenta em CI | Médio | Execução paralela (Playwright `--workers=4`). Cache DS assets. |
| Backup drill consome cota S3 | Baixo | Lifecycle rule 30 dias já cobre. |
| Security audit descobre vuln crítica pós-launch | Muito alto | Audit pre-launch + penetration test em staging. |

## 5. Rollback

Por sub-fase: `git revert` individual. DSAR rollback preserva logs — não desfaz erase (impossível; preservation intencional).

## 6. Convenção commits

- `feat(crm): DSAR endpoints (export/revoke/erase) (Fase 12.0 T1)`
- `feat(crm): RBAC dsar:execute (Fase 12.0 T2)`
- `ci(crm): lighthouse CI budgets (Fase 12.1)`
- `test(crm): E2E golden paths por role (Fase 12.2)`
- `ci(crm): backup drill scheduled (Fase 12.3)`
- `docs(crm): security audit checklist (Fase 12.4)`
- `docs(crm): runbook on-call + deploy (Fase 12.5)`
- `chore(crm): release ga (tag phase-12-ga)`

## 7. Dependências

- `@lhci/cli` ^0.15 — 12.1.
- `gitleaks` binary — 12.4 (CI).
- Existing: Playwright, Prisma, RBAC, consent lib.
