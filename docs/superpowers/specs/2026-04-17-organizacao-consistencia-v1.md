# Organização e Consistência de Código — Spec v1

**Data:** 2026-04-17
**Repo alvo:** `nexus-crm-krayin` (único impactado; blueprint fora do escopo)
**Motivação:** Cruzar o código do estado "funcional-mas-heterogêneo" para "sistema profissional" com:
- Módulos de rota com responsabilidade única por arquivo (nenhum `*.tsx` > 400 linhas).
- `src/lib/` sem ambiguidade `<name>.ts` + `<name>/` disputando o mesmo import.
- Server Actions por domínio particionadas em `queries.ts` + `mutations.ts` + `bulk.ts` + `schemas.ts`.
- Hooks num único lugar canônico.
- Route groups sem duplicação (`(app)` legacy eliminado).
- Tests num único padrão (`__tests__/`), não misturados com código.

## 1. Estado atual (linha de base)

- **420 TS/TSX files** em `src/`, distribuídos `app=88 / components=42 / lib=229`.
- **Monolitos de rota** (`_components/*-content.tsx`):
  - `products-content.tsx` 1.245 L
  - `leads-content.tsx` 1.057 L
  - `opportunities-content.tsx` 1.056 L
  - `tasks-content.tsx` 997 L
  - `contacts-content.tsx` 869 L
  - `workflow-editor-content.tsx` 800 L
  - `workflows-list-content.tsx` 662 L
  - `segments-list-content.tsx` 526 L
  - `attr-form-dialog.tsx` 531 L
  - `activity-timeline.tsx` 538 L
- **Ambiguidade em `src/lib/`** (arquivo solto + pasta com mesmo nome; TS resolve pela pasta/`index`):
  - `audit-log.ts` (44 L) + `audit-log/{events,persist.ts}` — 9 consumers.
  - `email.ts` (68 L) + `email/{oauth-state,tokens,tokens.test}` — 2 consumers.
  - `flags.ts` (2 L) + `flags/{index,registry,resolve,resolve.test,rollout}` — 1 consumer.
- **Route group legacy:** `src/app/(app)/settings/data-transfer/` coexistindo com `src/app/(protected)/settings/` (sem consumers diretos — é rota renderizada pelo próprio Next).
- **Server Actions gigantes:**
  - `src/lib/actions/activities.ts` 920 L
  - `src/lib/actions/leads.ts` 638 L
  - `src/lib/actions/products.ts` 599 L
  - `src/lib/actions/contacts.ts` 486 L
  - `src/lib/actions/custom-attributes.ts` 483 L
  - `src/lib/actions/opportunities.ts` 467 L
  - `src/lib/actions/marketing-campaigns.ts` 457 L
- **Hooks:** `src/lib/hooks/{use-debounced-value, use-saved-filters}.ts` (apenas 2; padrão Next 15+ sugere `src/hooks/`).
- **Tests mistos:** `src/lib/actions/*.test.ts` ao lado do código + `src/lib/__tests__/` + `src/lib/actions/__tests__/`.

## 2. Escopo (in/out)

### IN — 5 frentes
**F1. Ambiguidade `lib/<name>.ts` + `lib/<name>/`.**
- Mover conteúdo útil do `.ts` solto para `index.ts` dentro da pasta; deletar o arquivo solto.
- `audit-log.ts` (44 L): se for barrel de re-export, move para `audit-log/index.ts`. Se tiver código próprio, integra.
- `email.ts` (68 L): idem.
- `flags.ts` (2 L — já é stub): apenas deletar; consumers já apontam `@/lib/flags` (resolve em `flags/index.ts`).
- Smoke: `npx tsc --noEmit` + `npm run build` + todos os 9+2+1 consumers continuam compilando.

**F2. Route group legacy `(app)/settings`.**
- Mover conteúdo de `(app)/settings/data-transfer/` para `(protected)/settings/data-transfer/`.
- Deletar `src/app/(app)/` inteiro.
- Smoke: rota `/settings/data-transfer` mantém 200 em dev + redirect para login em prod.

**F3. Decomposição dos 10 monolitos `_components/*-content.tsx`.**
- Target: nenhum arquivo > **400 linhas**.
- Estratégia: cada arquivo vira uma pasta `_components/<entity>/`:
  - `list-view.tsx` (tabela + motion + empty state) ~200 L.
  - `form-dialog.tsx` (Dialog Create/Edit + schema ZOD) ~300 L.
  - `delete-confirm.tsx` (AlertDialog Bulk + single) ~80 L.
  - `use-<entity>-filters.ts` (filters + URL sync hook) ~100 L.
  - `types.ts` (entity-local types, se houver) ~40 L.
  - `index.tsx` (orchestrator público que monta CrmListShell + compose acima) ~150 L.
- Aplicar em `products`, `leads`, `opportunities`, `tasks`, `contacts`. Workflow-editor e campanhas ficam fora (menor ROI + escopo segundo momento).

**F4. Partição dos 7 arquivos gigantes de Server Actions.**
- Cada `src/lib/actions/<entity>.ts` vira pasta `src/lib/actions/<entity>/` com:
  - `index.ts` (re-exporta públicos — preserva imports existentes).
  - `queries.ts` (listX, getX, searchX).
  - `mutations.ts` (createX, updateX, deleteX).
  - `bulk.ts` (updateXBulk, deleteXBulk, assignXBulk).
  - `schemas.ts` (Zod schemas compartilhados).
  - `types.ts` (tipos locais se houver).
- Aplicar em: `activities`, `leads`, `products`, `contacts`, `custom-attributes`, `opportunities`, `marketing-campaigns`.
- Requisito crítico: `"use server"` no topo de cada `queries.ts` + `mutations.ts` + `bulk.ts` (schemas.ts e types.ts não podem ser server-only — Next 16 Turbopack rejeita re-export de types em `"use server"`). `index.ts` é barrel sem `"use server"`; re-exporta apenas funções.

**F5. Hooks + tests padronizados.**
- `src/lib/hooks/` → `src/hooks/` (padrão Next 15+). 2 arquivos.
- Consumers atualizados via find-replace `@/lib/hooks/` → `@/hooks/`.
- Tests: unificar em `__tests__/` co-localizado com o módulo (`src/lib/actions/<entity>/__tests__/mutations.test.ts`). Arquivos `*.test.ts` soltos ao lado de código migram.

### OUT (explícito)
- Reorganização Feature-Sliced Design completa (Opção A descartada).
- Decomposição de `workflow-editor-content.tsx`, `activity-timeline.tsx`, `attr-form-dialog.tsx`, `segments-list-content.tsx`, `workflows-list-content.tsx` (fica para Fase 36 se necessário).
- Renomear `src/generated/prisma/` (gerado pelo Prisma, não tocar).
- Tocar no blueprint (patterns já são profissionais, não há inconsistência relevante).
- Mudar padrões de styling/tokens/design.

## 3. Invariantes preservados (regressão zero tolerado)

- 823/823 Vitest verde.
- `npm run build` (`✓ Compiled successfully`).
- Todas as **11 rotas Fase 34** funcionais: `/dashboard`, `/leads`, `/contacts`, `/opportunities`, `/opportunities/pipeline`, `/products`, `/tasks`, `/marketing/campaigns`, `/marketing/segments`, `/automation/workflows`, `/settings/mailboxes`, `/settings/custom-attributes`.
- E2E existentes: 17+ golden-paths + visual-parity + preservation-smoke.
- Nenhum import público muda **externamente**: `@/lib/actions/leads` continua válido (resolve por barrel `leads/index.ts`); `@/components/dashboard/tasks-today-card` idem.
- Server Actions `"use server"` mantidas funcionais.
- RBAC/tenant scope/auth/Prisma absolutamente intocados.

## 4. Success criteria (mensuráveis)

1. **Zero arquivos > 400 L** em `src/app/(protected)/**/*-content.tsx`.
2. **Zero ambiguidade** `lib/<x>.ts` + `lib/<x>/` — grep `ls src/lib/*.ts` ≤ 5 arquivos (auth, logger, utils, prisma, tenant-scope, theme, app.config, encryption, etc. que não têm pastas homônimas).
3. **Zero `src/app/(app)/`** (pasta deletada).
4. **Tests em `__tests__/`**: `find src/lib/actions -name "*.test.ts" -not -path "*/__tests__/*" | wc -l` → 0.
5. **`src/hooks/` existe + `src/lib/hooks/` não existe**.
6. **Vitest 823/823 verde** pós-refactor (ou ≥ baseline se adicionarmos tests).
7. **Build ✓ Compiled** sem novos warnings.
8. **Smoke prod 200/307** nas 15 rotas.
9. **Deploy tag `fase-35-cleanup-deployed`**.
10. **Nenhum import externo quebra** — grep `from "@/lib/actions/leads"` continua encontrando resoluções.

## 5. Riscos e mitigações

| # | Risco | Mitigação |
|---|---|---|
| R1 | `"use server"` em `index.ts` quebra re-export | `index.ts` sem `"use server"`; só re-exporta; `queries/mutations/bulk` cada um com sua diretiva. |
| R2 | Decomposição altera closures do motion/state | Preservar `use client` só no orchestrator `index.tsx`; hooks filhos também `use client`. Extrair estado stepwise, testar build entre cada extração. |
| R3 | Barrel circular imports | Barrel só re-exporta; zero dependência inversa schemas→mutations→schemas. |
| R4 | `src/generated/prisma` tocado por acidente | Nenhum arquivo desta pasta no diff (ci check). |
| R5 | Import path update em massa errado | Find-replace scripted + `npx tsc --noEmit` + build entre cada frente. |
| R6 | Rota `(app)/settings/data-transfer` sumindo quebra link interno | grep `href.*data-transfer` antes de deletar; ajustar consumers. |

## 6. Estratégia de execução

1 frente = 1 commit atômico. Cada frente tem:
- `typecheck` verde.
- `build` verde.
- `vitest` verde.
- Commit com mensagem `refactor(fase-35): Fx — <descrição>`.

Ordem:
- F1 (lib ambiguity) — 3 sub-commits.
- F2 ((app) legacy) — 1 commit.
- F3 (monolitos) — 5 sub-commits (1 por entidade).
- F4 (server actions) — 7 sub-commits (1 por entidade).
- F5 (hooks + tests) — 2 sub-commits.

Total: ~18 commits.

## 7. Testes

- Rodar `npx vitest run` após cada frente — floor 823.
- Adicionar `src/__tests__/structural.test.ts` que valida os critérios de §4 (zero arquivos >400L, zero ambiguidade lib, etc.) — CI enforcement permanente.
- Playwright `preservation-smoke` continua verde.

## 8. Documentação

- `docs/HANDOFF.md` atualizado com "Fase 35 Cleanup".
- `docs/ARCHITECTURE.md` novo (ou atualizar existente) com convenções finais: pastas, naming, server actions, hooks, tests.
- Memory: `law_code_structure.md` nova (LEI ABSOLUTA sobre convenções).
- Graphify update.

## 9. Deploy

- Push `main` → CI Build+Push+Security verde (E2E pré-existente fail aceito).
- Portainer force update.
- Smoke prod 15 rotas.
- Tag `fase-35-cleanup-deployed`.

## 10. Próxima versão

- v2 incorpora Review #1 (code-reviewer agent).
- v3 pente fino.
- Plan v1→v2→v3 após spec v3 aprovada.
