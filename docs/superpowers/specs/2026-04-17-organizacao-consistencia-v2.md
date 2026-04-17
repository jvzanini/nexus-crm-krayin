# Organização e Consistência de Código — Spec v2

**Data:** 2026-04-17
**Versão:** v2 — incorpora Review #1 (3 críticos C1-C3, 4 altos H1-H4, 3 médios M1-M3).

## Mudanças vs v1

| # | Review | Ajuste v2 |
|---|---|---|
| C1 | `index.ts` barrel sem `"use server"` quebra Next 16 | `index.ts` declara `"use server"`; re-exporta **apenas funções**; types/schemas ficam em paths separados `/types` e `/schemas`. |
| C2 | F3 antes de F4 força retrabalho nos sub-arquivos | **Ordem:** F1 → F2 → F4 → F3 → F5. F4 consolida API primeiro; F3 consome fachada estável. |
| C3 | `export type` via barrel `"use server"` proibido | Consumers migram `@/lib/actions/leads` → `@/lib/actions/leads/types` para imports de tipos. Documentado. |
| H1 | `vitest.config.ts` path | Validar glob `src/**/*.test.{ts,tsx}` ainda pega `__tests__/`; sem mudança necessária. |
| H2 | `(app)/settings/data-transfer` é rota ATIVA | **Mover** (não deletar) para `(protected)/settings/data-transfer/`. |
| H3 | 18 commits sem preservation-smoke | Rodar `preservation-smoke.spec.ts` local após cada sub-commit F3/F4. |
| H4 | Critério #1 escopo | Limitar a "Zero arquivos > 400L nas 5 entidades de F3". |
| M1 | State sharing em F3 | Usar `useReducer` + context local no orchestrator quando callbacks > 10. |
| M2 | `structural.test.ts` bloqueante | Transformar em **warning** (test que `console.warn`) + allowlist explícita. |
| M3 | `law_code_structure.md` | Rebaixar para `convention_code_structure.md`. |

## 1. Estado atual (linha de base)

Idêntico v1 §1 (420 TS/TSX, 10 monolitos list-content, 3 pares ambíguos lib/, 7 server-actions gigantes, hooks em lib/, route group legacy).

## 2. Escopo (in/out) — atualizado

### IN — 5 frentes

**F1. Ambiguidade `lib/<name>.ts` + `lib/<name>/`.**
Idêntico v1.

**F2. Route group legacy `(app)/settings` — MOVER, não deletar.**
- Mover `src/app/(app)/settings/data-transfer/` → `src/app/(protected)/settings/data-transfer/`.
- Deletar `src/app/(app)/` (ficará vazio).
- Grep `href.*data-transfer` — atualizar zero consumers (rota stays same `/settings/data-transfer`).
- Verificar sidebar nav (`src/lib/constants/navigation.ts`) se tem item apontando.
- Smoke: `/settings/data-transfer` 307 em prod.

**F4. Partição dos 7 arquivos gigantes de Server Actions — REESCRITA.**

Cada `src/lib/actions/<entity>.ts` vira pasta `src/lib/actions/<entity>/`:

```
src/lib/actions/leads/
├── index.ts          ← "use server" + re-exporta SÓ funções
├── queries.ts        ← "use server" — listLeads, getLead, searchLeads
├── mutations.ts      ← "use server" — createLead, updateLead, deleteLead
├── bulk.ts           ← "use server" — updateLeadsStatusBulk, deleteLeadsBulk, assignLeadsBulk
├── schemas.ts        ← Zod schemas (NÃO "use server" — values passáveis)
├── types.ts          ← tipos TS (NÃO "use server" — só types)
└── __tests__/
    ├── queries.test.ts
    ├── mutations.test.ts
    └── bulk.test.ts
```

**Regras de import:**
- `@/lib/actions/leads` → resolve `index.ts` (só funções). Consumers de funções **não mudam**.
- `@/lib/actions/leads/types` → tipos (`LeadItem`, `LeadsFilters`). **Consumers de tipos migram**.
- `@/lib/actions/leads/schemas` → schemas Zod. Consumers (form dialogs, server handlers) migram.

**Migration sweep:**
```bash
# Find consumers de types do path antigo
grep -rln 'from "@/lib/actions/leads"' src | xargs grep -l 'import type\|type {' 
# → ajusta cada pra "@/lib/actions/leads/types"
```

Aplicar em: `activities`, `leads`, `products`, `contacts`, `custom-attributes`, `opportunities`, `marketing-campaigns`.

**Atenção crítica:** `index.ts` MUST ter `"use server"` porque re-exporta Server Actions. Turbopack exige module boundary para registro de action IDs.

**F3. Decomposição dos monolitos `_components/*-content.tsx` — DEPOIS de F4.**
- Escopo específico: **apenas 5 entidades** `products`, `leads`, `opportunities`, `tasks`, `contacts`.
- Target: nenhum arquivo >400L nessas 5.
- Estrutura por entidade:
  ```
  (protected)/<entity>/_components/
  ├── index.tsx              ← orchestrator (CrmListShell + state + context)
  ├── list-view.tsx
  ├── form-dialog.tsx
  ├── delete-confirm.tsx
  ├── use-<entity>-filters.ts
  └── context.tsx            ← useReducer + <EntityContext> quando callbacks > 10
  ```
- **State sharing** (fix M1): orchestrator declara `useReducer` + provider; sub-arquivos consomem `useContext`. Só usar context quando monolito tem >10 callbacks drilados.
- Preservation-smoke local após cada entidade.

**F5. Hooks + tests padronizados.**
- `src/lib/hooks/` → `src/hooks/`. 2 arquivos.
- Find-replace `@/lib/hooks/` → `@/hooks/`.
- Tests: co-localizar em `__tests__/` dentro do módulo pai. Migrar os `*.test.ts` soltos em `src/lib/actions/` para `src/lib/actions/<entity>/__tests__/`.

### OUT (explícito)
- Feature-Sliced Design completo.
- Decomposição de `workflow-editor-content` (800L), `activity-timeline` (538L), `attr-form-dialog` (531L), `segments-list-content` (526L), `workflows-list-content` (662L).
- `src/generated/prisma/` intocado.
- Blueprint patterns intocados.
- Tokens/design/style não tocados.

## 3. Invariantes preservados — AJUSTADO

- 823/823 Vitest verde.
- `npm run build` ✓.
- 11 rotas Fase 34 + Fase 34B + `/settings/data-transfer` funcionais.
- E2E golden-paths.
- **Public surface de FUNÇÕES de `@/lib/actions/<entity>` inalterada.**
- **Public surface de TIPOS migra para `/types` subpath — documentado em MIGRATION.md.**
- **Public surface de SCHEMAS migra para `/schemas` subpath — documentado em MIGRATION.md.**
- RBAC/tenant scope/auth/Prisma intocados.

## 4. Success criteria — AJUSTADO

1. **Zero arquivos > 400 L nas 5 entidades F3**: `products-content.tsx`, `leads-content.tsx`, `opportunities-content.tsx`, `tasks-content.tsx`, `contacts-content.tsx` (arquivos legados deletados; orchestrator `index.tsx` + sub-arquivos <400L cada).
2. **Zero ambiguidade** em `src/lib/` (F1 resolvido).
3. **Zero `src/app/(app)/`** (pasta deletada, conteúdo movido).
4. **Tests em `__tests__/`**: grep `*.test.ts` solto em `src/lib/actions/` → 0 (excluindo `__tests__/` dirs).
5. **`src/hooks/` existe + `src/lib/hooks/` não existe**.
6. **Vitest 823/823 verde** pós-refactor.
7. **Build ✓ Compiled** sem novos warnings.
8. **Smoke prod 200/307** em 15 rotas + `/settings/data-transfer`.
9. **Deploy tag `fase-35-cleanup-deployed`**.
10. **`index.ts` de cada pasta actions tem `"use server"`** + re-exporta **só funções** (zero `export type` nos barrels). Grep enforcement.
11. **`src/__tests__/structural.test.ts`** presente, rodando como warning (fails não bloqueiam CI; apenas `console.warn` + lista allowlist).

## 5. Riscos e mitigações — AJUSTADO

| # | Risco | Mitigação |
|---|---|---|
| R1 | `index.ts` sem `"use server"` quebra action registry | **v2 C1 fix:** `index.ts` declara `"use server"`; só re-exporta funções. |
| R2 | Re-export de types via barrel `"use server"` | **v2 C3 fix:** types/schemas fora do barrel; consumers migram para `/types` e `/schemas`. |
| R3 | Decomposição altera closures do motion/state | **v2 M1 fix:** context/useReducer no orchestrator quando callbacks > 10. |
| R4 | Barrel circular | Barrel só re-exporta; schemas independentes. |
| R5 | `src/generated/prisma` tocado por acidente | Verificação manual de diff antes cada commit. |
| R6 | Import path update errado em massa | Script find-replace + `npx tsc --noEmit` + `npm run build` entre frentes. |
| R7 | Rota `(app)/settings/data-transfer` quebrar | **v2 H2 fix:** MOVER, não deletar; smoke `/settings/data-transfer`. |
| R8 | Preservation-smoke só em PR | **v2 H3 fix:** rodar `preservation-smoke.spec.ts` local após cada sub-commit F3/F4. |
| R9 | Reordenação F4→F3 causa re-trabalho | **v2 C2 fix:** F4 consolida primeiro, F3 consome API estável. |
| R10 | Tests path quebra vitest | **v2 H1 fix:** glob atual cobre `__tests__/`; validar rodando `npx vitest run` após F5. |

## 6. Estratégia de execução — AJUSTADO

**Ordem:**
1. F1 (3 sub-commits — um por par ambíguo).
2. F2 (1 commit — mover + deletar legacy).
3. **F4 (7 sub-commits — um por entidade).** ← Antes de F3.
4. **F3 (5 sub-commits — um por entidade).** ← Depois de F4.
5. F5 (2 sub-commits — hooks + tests).

**Total: 18 commits.**

Checkpoint por commit: `typecheck` + `build` + `vitest` + smoke `preservation-smoke.spec.ts` local (em commits F3/F4).

Mensagem commit pattern: `refactor(fase-35): Fx.N — <descrição>`.

## 7. Testes

- `npx vitest run` após cada frente — floor 823.
- **`src/__tests__/structural.test.ts`** novo — **warning-only**, não bloqueia CI:
  ```ts
  it('monolitos F3 estão abaixo de 400L (warning)', () => {
    const limits = [
      'products/_components/products-content.tsx', /* etc */
    ];
    for (const f of limits) {
      const lines = readFileSync(f, 'utf8').split('\n').length;
      if (lines > 400) {
        console.warn(`⚠️ ${f}: ${lines}L > 400L`);
      }
    }
    // Não assert; apenas warning.
  });
  ```
- Preservation-smoke local entre commits F3/F4 (comando específico).

## 8. Documentação — AJUSTADO

- `docs/HANDOFF.md` atualizado com "Fase 35 Cleanup".
- `docs/ARCHITECTURE.md` novo: convenções (pastas, naming, server actions barrel pattern, hooks, tests).
- `docs/MIGRATION.md` novo: `@/lib/actions/<entity>` → `.../types` e `.../schemas` (para developers que consumirem types/schemas no futuro).
- Memory: **`convention_code_structure.md`** (NÃO lei — v2 M3 fix). Formato: `type: reference`.
- Graphify update.

## 9. Deploy

- Push `main` → CI verde.
- Portainer force update.
- Smoke prod (15 + /settings/data-transfer = 16 rotas).
- Tag `fase-35-cleanup-deployed`.

## 10. Próxima versão

- v3 pente fino (Review #2).
- Plan v1→v2→v3.
