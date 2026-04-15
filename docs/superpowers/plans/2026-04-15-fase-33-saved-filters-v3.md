# Plan Fase 33 — Saved Filters (v3 FINAL)

**Spec:** `docs/superpowers/specs/2026-04-15-fase-33-saved-filters-v3.md`.

## Mudanças v1→v2→v3

- v1: tasks macro.
- v2 (review #1): arquivos exatos + sucesso por task + ordenação de dependências.
- v3 (review #2): paralelização identificada; migration psql procedimento; dependência entre grupos explícita; riscos de concorrência no default.

## 0. Preparação

### T0.1 — Migration Prisma local
- Editar `prisma/schema.prisma` adicionando enum `SavedFilterModule` + model `SavedFilter` + relações em User/Company.
- `npx prisma migrate dev --name add_saved_filters`.
- Inspecionar SQL gerado em `prisma/migrations/<pasta>/migration.sql`; adicionar `IF NOT EXISTS` onde Prisma gerar sem idempotência (se necessário patch manual).
- `npx prisma generate` (Prisma 7 imports de `@/generated/prisma/client`).
- **Sucesso:** build local passa; `SavedFilter` tipo importável.

### T0.2 — Zod schemas
- Novo `src/lib/actions/saved-filters-schemas.ts` com `SavedFilterModuleZ`, `SaveFilterSchema`, `UpdateFilterSchema`, `SetDefaultSchema`.
- **Sucesso:** typecheck.

## 1. Grupo A — Server actions + tests

### T-ACT.1 — `src/lib/actions/saved-filters.ts`
- 6 exports: `listSavedFilters`, `saveFilter`, `updateFilter`, `deleteFilter`, `setDefaultFilter`, `getDefaultFilter`.
- Padrão Zod `safeParse(raw)` + `requirePermission("${moduleKey}:view")` dinâmico + `requireActiveCompanyId` + `session.user.id`.
- `setDefaultFilter` via `prisma.$transaction([updateMany unset, update set])`.
- `saveFilter` valida limite 20 via `count()` antes do create.
- `updateFilter({setAsDefault:true})` delega para `setDefaultFilter` internamente pra garantir transação.
- `getDefaultFilter` é helper síncrono server-component (retorna `SavedFilter|null`, sem ActionResult).

### T-ACT.2 — Tests Vitest `src/lib/actions/__tests__/saved-filters.test.ts`
- Mock Prisma + requirePermission + resolveActiveCompanyId.
- Casos:
  1. saveFilter respeita limite 20 (retorna erro no 21º).
  2. setDefaultFilter unset anterior + set novo em transaction.
  3. deleteFilter exige ownership (userId+companyId no where).
  4. listSavedFilters filtra por user+company+module.
  5. saveFilter duplicate name → erro unique constraint.
- **Sucesso:** ≥5 casos verdes.

## 2. Grupo B — UI componentes

### T-UI.1 — `src/lib/hooks/use-saved-filters.ts`
- Hook retorna `{list, loading, reload}`.

### T-UI.2 — `src/components/tables/saved-filters-menu.tsx`
- Popover com lista + ações "Salvar atual" + "Gerenciar".
- Empty state PT-BR.
- Ícones Lucide (Star/Save/Settings2/BookmarkPlus).

### T-UI.3 — `src/components/tables/save-filter-dialog.tsx`
- Dialog com Input + Checkbox "Usar como padrão" + Preview read-only dos filtros.
- Botões Salvar/Cancelar.

### T-UI.4 — `src/components/tables/manage-filters-dialog.tsx`
- Dialog com tabela (Nome editável inline / ⭐ default toggle / botão Excluir).
- AlertDialog confirmação delete.

### T-UI.5 — Estender `FilterBar` com prop `savedFilters?`
- Quando presente: renderiza `SavedFiltersMenu` à esquerda de "Limpar filtros".
- Tooltip no "Limpar" quando há default ativo.

### T-UI.6 — Tests Vitest (opcional)
- Testar empty state render / save/apply flow via RTL.

## 3. Grupo C — Integração 8 módulos

Depende de A + B.

Aplicar em cada content + page:

### T-INT.1 — Products
### T-INT.2 — Tasks
### T-INT.3 — Campaigns
### T-INT.4 — Segments
### T-INT.5 — Workflows
### T-INT.6 — Leads
### T-INT.7 — Contacts
### T-INT.8 — Opportunities

Em cada:
- Page: `getDefaultFilter("<module>")` quando `Object.keys(params).length === 0` → usar filters do default. Passar para content.
- Content: `const saved = useSavedFilters("<module>")`; prop `savedFilters` no FilterBar; `onApply` valida com Zod do módulo via `safeParse` antes de setState.

## 4. Grupo D — E2E + Deploy

### T-E2E.1 — `tests/e2e/golden-paths/saved-filters.spec.ts`
- 1 caso: login admin → /leads → salvar filtro → confirmar aparece no menu → aplicar → URL atualiza.

### TZ.1-TZ.12 — Verificação + deploy
- lint (se CI tolera), typecheck, `npm run test` (esperar ≥711 casos = 706 + 5 novos mínimos), `npm run build`.
- Commit segmentado (A/B/C/D + docs).
- Push → CI.
- **Migration psql em prod:** pós Build success, antes do primeiro user acessar feature:
  ```sh
  export PTOKEN=$(grep PORTAINER_TOKEN .env.production | cut -d= -f2)
  export PURL=$(grep PORTAINER_URL .env.production | cut -d= -f2)
  TASK=$(/usr/bin/curl -s -H "X-API-Key: $PTOKEN" "$PURL/api/endpoints/1/docker/tasks?filters=%7B%22service%22%3A%5B%22nexus-crm-krayin_db%22%5D%7D")
  CID=$(echo "$TASK" | python3 -c "import json,sys; d=json.load(sys.stdin); r=[t for t in d if t.get('Status',{}).get('State')=='running']; print(r[0]['Status']['ContainerStatus']['ContainerID'][:12] if r else '')")
  # Aplicar migration via exec
  /usr/bin/curl -s -H "X-API-Key: $PTOKEN" -X POST "$PURL/api/endpoints/1/docker/containers/$CID/exec" \
    -d '{"Cmd":["psql","-U","nexus","-d","nexus_crm_krayin","-f","<mount-path>/migration.sql"],"AttachStdout":true}'
  ```
  Ou mais simples via `docker exec` local se tiver túnel.
- Smoke prod `/login 200 /api/health 200 /api/ready 200`.
- Tag `phase-33-saved-filters-deployed`.
- HANDOFF + memory update.

## Dependências

- T0 bloqueia todos.
- A independente de B (actions ↔ UI).
- B independente de A.
- C depende de A + B.
- D depende de C.

## Paralelização recomendada

- Rodada 0 (seq): T0.1 + T0.2.
- Rodada 1 (paralelo): A (1 subagent) + B (1 subagent).
- Rodada 2 (seq ou paralelo disjoint por módulo): C (1-3 subagents).
- Rodada 3 (seq): D (E2E + verify + deploy + migration).

## Critérios globais

Ver spec §10. +7 tests Vitest mínimos (saveFilter/limit/setDefault/delete/list/duplicate name + 1 E2E).
