# Fase 12.5 — Runbook Expansion

**Data:** 2026-04-14
**Status:** spec v3
**Depends on:** Fase 12.4 deployed

## 1. Contexto

`docs/ops/runbook.md` v1.0 cobre deploy, triage on-call básico, contatos,
infra, secrets, observabilidade e go-live checklist (191 linhas).

Durante a sessão autônoma de 2026-04-14 foram resolvidos incidentes reais
que produziram conhecimento operacional ainda não registrado no runbook:

1. **Login 500 em prod** — causa raiz: dual React de vendor packages UI
   (@nexusai360/profile-ui, settings-ui) fora de `transpilePackages`. Fix
   em `next.config.ts`.
2. **Build quebrado** — causa raiz: `new Resend(process.env.RESEND_API_KEY)`
   top-level quebrava page-data collection quando env var ausente (CI Docker
   build). Fix: lazy `getResend()`.
3. **Schema DB desatualizado** — migrations 20260415..20260424 não aplicadas;
   Prisma v7 não roda `migrate deploy` em runtime. Fix: `prisma db push --url`
   dentro do container app via Portainer exec.
4. **System user faltando** — automation actions dependiam de UUID nil
   (`00000000-...`) em tabela `users`; fix: `INSERT ... ON CONFLICT` via
   Portainer exec no container db.

Além disso, LEI ABSOLUTA #1 (debug via Portainer container logs PRIMEIRO)
está em `CLAUDE.md` mas não tem entry point fácil no runbook — quem for
triage on-call deveria encontrar o comando canônico lá direto.

## 2. Objetivo

Expandir `docs/ops/runbook.md` com:

- **Seção LEI ABSOLUTA #1** — o que é, por quê, comando canônico, exemplo
  real (incidente 2026-04-14).
- **Seção "Playbooks de incidentes resolvidos"** — case studies dos 4 problemas
  acima com causa raiz + sinais + fix aplicado + referência a commit.
- **Seção "Procedimentos DB avançados"** — aplicar migrations via
  `prisma db push` no container; criar/seedar rows via SQL direto; restore
  de backup; reset de system user.
- **Seção "Onboarding"** — passos para novo dev ou operador entrar no projeto
  (fork→clone→env local→DB local→seed→npm run dev→primeiro commit).

Critérios de sucesso:

- Runbook tem ≥ 4 seções novas ou expandidas.
- Cada incidente resolvido na sessão 2026-04-14 tem playbook com link para
  commit SHA.
- LEI #1 tem exemplo visual (antes/depois) que deixa claro o ganho.
- Onboarding completa em ≤ 30 min para dev com familiaridade em Next/Prisma.

Fora de escopo:

- Mudar formato do runbook (markdown simples continua).
- Substituir referências cruzadas com CLAUDE.md ou security.md.
- Escrever runbook em outro idioma ou traduzir.

## 3. Arquitetura

Doc-only. Edit em `docs/ops/runbook.md` + commit único. Sem mudança de código
ou config.

Estrutura alvo (ordem final):

1. Deploy (existente)
2. LEI ABSOLUTA #1 — debug via Portainer logs (NOVO)
3. On-call triage (existente, expandido com §2.6 = login 500)
4. Playbooks resolvidos (NOVO — 4 sub-seções)
5. Procedimentos DB avançados (NOVO — migrations, seed SQL, restore, system user)
6. Onboarding (NOVO)
7. Contatos (existente)
8. Infraestrutura (existente)
9. Secrets management (existente)
10. Observabilidade (existente)
11. Go-live checklist (existente)

## 4. Testes

- Self-review: ler o runbook do topo ao fim simulando on-call noite; cada
  comando deve ser copy-paste executável sem adaptação.
- Validar comandos: `/api/health`, `/api/ready`, curl headers, Portainer
  exec — todos já validados em sessão 2026-04-14.

## 5. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Runbook fica longo demais (>500 linhas) | média | split em arquivos se passar de 800; atualmente 191 + estimado +300 = 500 |
| Comando copy-paste desatualiza | alta | todo comando referencia variáveis via `$VAR` + secrets de `.env.production` local |
| Exemplos expõem secret real | baixa | revisar antes de commit; usar placeholders `<SHA>`, `<CID>` |

## 6. Entregáveis

1. `docs/ops/runbook.md` expandido com 4 seções novas.
2. Commit único `docs(ops): runbook expansion — Fase 12.5`.
3. Tag `phase-12-5-deployed` após push.

## 7. Não-objetivos explícitos

- Sentry wiring (Fase 1c).
- Automação de on-call (pagerduty/opsgenie).
- Tradução para inglês.
- Criação de outro doc além do runbook.
