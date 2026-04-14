# Plan: Fase 1b — Foundation B (migração de telas + consent LGPD)

**Data:** 2026-04-14
**Versão:** v3 (final — após Review 1 ampla e Review 2 profunda)
**Spec:** `docs/superpowers/specs/2026-04-14-fase-1b-foundation-b-design.md` (v3)
**Repo:** `/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin`

---

## Changelog

### v2 → v3 (Review 2 profunda)
- **T0 (baseline visual) obrigatório antes de tudo.** Qualquer swap de import sem baseline pré quebra o loop de regressão.
- **T11 lint rule** ganha teste unit (ESLint RuleTester) com fixture positiva/negativa.
- **T18 backfill script** é executado dentro de `prisma migrate deploy`? NÃO — script separado por segurança; ordem: migrate → manual node script → commit.
- **T15 multi-tenant sanity test** usa seed com 2 companies. Adicionado prerequisite T14.5 para garantir seed ter fixtures.
- **T9 checkbox mantido local** — removido item pronto-para-delete do checkpoint de delete; ficou explícito na lista "don't delete".
- **T19 aceite Portainer** aceita `fallback: manual registrado em memory` quando URL unreachable (replicando problema Fase 1a).
- Todas as T marcadas como "paralelizáveis via subagent" agora têm campo `subagent_safe: yes/no` — swap visual (sim), consent library (não — compartilha estado).

### v1 → v2 (Review 1 ampla)
- Adicionado T0 (baseline visual pré-migração) — crítico.
- T16 (deploy) dividido em T16a (build CI) + T16b (tag + rollout) para separar falha infra vs falha código.
- Aceite de cada T endurecido com comando `grep`/`pnpm test`/`playwright` reproduzível.
- Ordem de execução restrita: nenhum swap P1 antes de P0 verde.

---

## Sequência de tasks

### Pré-requisitos (bloqueiam T1+)

**T0. Baseline visual pré-migração**
- Criar `tests/e2e/screens.spec.ts` que abre 10 rotas × 3vp × 2 temas e captura screenshots via `toHaveScreenshot({ maxDiffPixelRatio: 0.001 })`.
- Rodar no workflow `crm-a11y.yml` com `update_snapshots=true` (ou manual local após token refresh) para gerar baselines.
- Commit dos snapshots em `tests/e2e/screens.spec.ts-snapshots/`.
- **subagent_safe:** no (requer infra CI pronta).
- **Aceite:** 60 PNGs commitados; spec executa localmente/CI verde.

### 1b.0 — Migração visual pura

**T1. Swap imports em `src/app/layout.tsx` + `(protected)/layout.tsx`**
- Criar `(protected)/layout.tsx` se não existir e adotar `AppShell.Root/Sidebar/Content/Header/Main`.
- `Toaster` passa a vir do DS.
- **subagent_safe:** sim.
- **Aceite:** rota `/` carrega sem console error; `grep "from \"@/components/ui/(sonner|toaster)\"" src/app | wc -l` = 0.

**T2. Swap imports em `(auth)/*`**
- 4 rotas (login, forgot-password, reset-password, verify-email).
- **subagent_safe:** sim — 1 subagent para as 4 rotas.
- **Aceite:** `grep -rE "from \"@/components/ui/(button|card|input|label)\"" src/app/\\(auth\\)` = 0; E2E auth-flow.spec verde.

**T3. Swap imports em `(protected)/dashboard`**
- **subagent_safe:** sim.
- **Aceite:** idem + visual regression ≤ 0.1%.

**T4. Swap imports em `(protected)/leads/*` (P0)**
- Só imports aqui; consent fica em T12.
- **subagent_safe:** sim.
- **Aceite:** imports DS; baseline regression ≤ 0.1%.

**T5. Swap imports em `(protected)/contacts/*` (P0)**
- **subagent_safe:** sim.
- **Aceite:** idem.

**T6. Swap imports em `(protected)/opportunities/*` (P1)**
- **subagent_safe:** sim.

**T7. Swap imports em `(protected)/{profile,users,companies,settings}/*` (P1)**
- 1 subagent por rota ou batch.
- **subagent_safe:** sim.

**T8. Delete `src/components/ui/{button,card,input,label,switch,sonner,dialog,alert-dialog,table}.tsx`**
- Após T1–T7 verdes; rodar `grep -rE "from \"@/components/ui/(button|card|input|label|switch|sonner|dialog|alert-dialog|table)\"" src/` = 0. Se 0, delete.
- **Aceite:** `ls src/components/ui/` mostra só `popover.tsx`, `checkbox.tsx`, `custom-select.tsx`, `badge.tsx` (se existe).

**T9. Visual regression post-swap**
- Rodar `npx playwright test tests/e2e/screens.spec.ts`. Esperado verde (≤ 0.1% diff).
- Divergências intencionais: commit com nova baseline + justificativa.
- **Aceite:** workflow verde.

### 1b.1 — Consent LGPD

**T10. Migration Prisma**
- `prisma migrate dev --name add_consent_to_leads_contacts_and_consent_logs`.
- Schema conforme spec §3.4.1.
- Commit migration + `schema.prisma` atualizado.
- **Aceite:** `prisma migrate deploy` em test DB passa; `\d leads` mostra colunas novas.

**T11. ESLint rule `no-direct-consent-write`**
- Arquivo: `eslint-rules/no-direct-consent-write.js` (plain JS p/ compat); test em `eslint-rules/no-direct-consent-write.test.js` com `RuleTester`.
- Declarar em `.eslintrc.cjs` como `plugins: ['local-rules']`.
- **Aceite:** `pnpm lint` passa; teste unit da rule verde; tentar escrever `prisma.lead.update({ data: { consentMarketing: true } })` fora de `src/lib/consent` falha.

**T12. Lib `src/lib/consent/`**
- `index.ts` com `recordConsent`, `getActiveConsent`, `maskIp`, `canSendMarketing`, `canTrackOpen`.
- `maskIp`: usa regex ou `ip-address` npm (já em deps? se não, usar impl própria pequena).
- Unit tests `src/lib/consent/index.test.ts` cobrindo todos os helpers + idempotência.
- **subagent_safe:** no (estado central).
- **Aceite:** `pnpm test -- consent` verde; coverage ≥ 90% nessa pasta.

**T13. Server actions — leads**
- `src/server/actions/lead.ts`: `createLeadAction`/`updateLeadAction` usando `recordConsent` em transação.
- Zod schema `createLeadSchema` obriga `consent.marketing` e `consent.tracking` (Zod `z.boolean()` sem default).
- **Aceite:** integração test `leads-consent.test.ts` verde (create com opt-in cria 2 logs + denormalizados; update muda só marketing → 1 log adicional).

**T14. Server actions — contacts**
- Análogo a T13.
- **subagent_safe:** sim (após T12).

**T14.5. Seed demo com 2 companies**
- `prisma/seed.ts` cria 2 companies + 3 leads em cada + 3 contacts em cada.
- **Aceite:** `pnpm prisma:seed` popula DB de staging; `SELECT COUNT(*) FROM companies` = 2.

**T15. Multi-tenant sanity test**
- `src/server/actions/lead.test.ts`: com session do company A, `listLeads` retorna apenas leads de A. `consent_logs` filtra via `subjectId IN (SELECT id FROM leads WHERE companyId=A)`.
- **Aceite:** teste verde.

**T16. Forms UI — Leads**
- `(protected)/leads/_components/lead-form.tsx`: fieldset consent conforme spec §3.4.2.
- Input i18n keys.
- **Aceite:** E2E `leads-consent.spec.ts` verde (criar/editar/mudar).

**T17. Forms UI — Contacts**
- Análogo.

**T18. Backfill script**
- `prisma/scripts/backfill-consent.ts`: para cada Lead/Contact existente, insere 1 log `source='backfill_migration'`, `granted=false`, `reason='Registro pré-1b; consent pendente'`. Denormalizados já estão `false` via migration default.
- Idempotente: `ON CONFLICT DO NOTHING` via índice único `(subjectType, subjectId, consentKey, source='backfill_migration')` — adicionar esse índice parcial na migration do T10.
- Executar em staging + prod após T10 merge.
- **Aceite:** `SELECT COUNT(*) FROM consent_logs WHERE source='backfill_migration'` = `leads.count * 2 + contacts.count * 2`.

### 1b.2 — Hardening

**T19. i18n**
- Adicionar namespace `consent` em `messages/pt-BR.json` e `messages/en.json`.
- Script `scripts/check-i18n-parity.ts`: compara keys entre locales, falha se divergentes.
- Integrar no `pnpm lint` (ou CI step dedicado).
- **Aceite:** script verde; formulários renderizam strings localizadas.

**T20. `docs/lgpd.md`**
- Resumo: base legal, fluxo de consent, predicates em 7/9, endpoints DSAR em 12, política retention, how to rollback.
- **Aceite:** commit do arquivo.

**T21. CI — crm-a11y roda screens.spec + a11y-screens.spec**
- Expandir workflow `crm-a11y.yml` para também executar visual + a11y de todas as 10 rotas.
- **Aceite:** workflow verde em PR de merge final.

**T22. Performance budget via Lighthouse CI**
- `.lighthouserc.json` define budgets §3.7.
- CI roda lhci em 3 rotas representativas: `/`, `/dashboard`, `/leads`.
- **Aceite:** lhci verde no CI.

**T23. Tag + deploy**
- `git tag phase-1b-deployed`.
- Push → build.yml → ghcr.io → Portainer rollout.
- Se Portainer unreachable: registrar em `memory/reference_deploy_portainer.md` com comando manual de retry.
- **Aceite:** imagem com tag `:phase-1b-deployed` em ghcr.io. Deploy Portainer OK ou documentado.

**T24. Update memory + Appendix roadmap**
- Memory files novos:
  - `consent_pattern.md` — recordConsent pattern + idempotência + ipMask.
  - `visual_regression_threshold.md` — 0.1% diff, process de revisão.
  - `legacy_ui_components.md` — o que ainda está em `src/components/ui/` e por que.
  - `consent_predicates.md` — canSendMarketing/canTrackOpen como API contrato p/ Fases 7/9.
- Appendix A roadmap: "Screens migradas DS", "Consent LGPD Leads/Contacts", "ESLint rule no-direct-consent-write" → `parity`.
- Atualizar `project_crm_phase_status.md`: Fase 1b ✅.

---

## Ordem de execução

1. **T0** (baseline visual) — sozinho, prerequisite estrito.
2. **T1** (layouts) — sozinho.
3. **T2–T5** (P0) — paralelo em subagents (1 por bloco de rotas).
4. **T9** (regression post-P0-swap) — sozinho.
5. **T6–T7** (P1) — paralelo.
6. **T8** (delete locais) — após T9 verde + P1 verde.
7. **T10** (migration) — independente de T1-T9; pode rodar em paralelo a partir do início.
8. **T11** (lint rule) — sozinho.
9. **T12** (lib consent) — depois de T10. Não paralelizável.
10. **T13–T14** (server actions) — paralelo (leads/contacts após T12).
11. **T14.5** (seed) — paralelo a T13/T14.
12. **T15** (multi-tenant test) — após T13/T14 + T14.5.
13. **T16–T17** (forms UI) — após T13/T14. Paralelo.
14. **T18** (backfill) — após T10 + T12 + merge staging.
15. **T19–T22** (hardening) — paralelo após 1b.0 e 1b.1 verdes.
16. **T23** (deploy) — serial final.
17. **T24** (memory) — sozinho, último.

Estimativa:
- Paralelizado com subagents: 1.5 dias.
- Serial conservador: 4 dias.
- Autonomous YOLO: ~1 dia em CI-bound time.

## Convenção de commits

- `test(crm): baseline visual 10 rotas (pré-1b)` (T0)
- `chore(crm): AppShell em (protected)/layout + Toaster DS` (T1)
- `feat(crm): migrate (auth) to @nexusai360/design-system` (T2)
- `feat(crm): migrate (protected)/leads to design-system` (T4) — idem para cada
- `chore(crm): delete duplicatas src/components/ui migradas` (T8)
- `feat(crm): migration consent LGPD + consent_logs table` (T10)
- `chore(crm): eslint rule no-direct-consent-write` (T11)
- `feat(crm): lib src/lib/consent (recordConsent, predicates)` (T12)
- `feat(crm): server action lead com consent transacional` (T13)
- `feat(crm): form UI consent LGPD em leads/contacts` (T16+T17)
- `chore(crm): backfill consent_logs para registros legacy` (T18)
- `feat(crm): i18n consent + check-i18n-parity` (T19)
- `docs(crm): docs/lgpd.md` (T20)
- `ci(crm): crm-a11y roda screens.spec + perf budget` (T21+T22)
- `chore(crm): release fase 1b (tag phase-1b-deployed)` (T23)

## Rollback

Conforme spec §8. Sem kill-switch; `git revert` + migration down.

## Dependências externas

Zero novas. Todas já declaradas:
- Prisma 7, Zod, Playwright, @axe-core/playwright, @lhci/cli.
- Lib `ip-address` opcional (pode ser regex). Preferir sem.
