# Organização e Consistência de Código — Spec v3 FINAL

**Data:** 2026-04-17
**Versão:** v3 definitiva — incorpora Review #2 (7 críticos sutis: barrel neutro, schemas↔types direção, action args primitives, structural.test pattern, smoke por frente, merge squash, `*-schemas.ts` legacy, F5 antes F4).
**Status:** pronta para writing-plans.

## Mudanças vs v2

| # | Review #2 | Ajuste v3 |
|---|---|---|
| C-SUTIL-1 | Barrel `"use server"` double-boundary | **Barrel NEUTRO** (sem `"use server"`). Cada `queries.ts`/`mutations.ts`/`bulk.ts` com `"use server"`. Barrel re-exporta funções **e** types/schemas. Consumers 100% compat. |
| C-SUTIL-2 | Ciclo `schemas ↔ types` | **Direção fixada:** `types.ts` importa de `schemas.ts` (via `z.infer`); inverso proibido. Lint rule. |
| C-SUTIL-3 | Server Action args | **Contrato explícito:** args = `FormData` ou primitives/JSON-serializable. Closures via `.bind()` apenas com primitives. |
| C-SUTIL-4 | `console.warn` em test é anti-pattern | `test.fails()` com allowlist + amarelo no reporter. |
| C-SUTIL-5 | Preservation-smoke por commit não escala | **Preservation-smoke por FRENTE (5×), não por commit.** Checkpoint intra-frente = typecheck+build+vitest. |
| C-SUTIL-6 | Rollback granular | **Política merge:** squash por frente; revert = revert squash. Commits intermediários ficam no histórico mas merge `main` é atomizado por frente. |
| C-SUTIL-7 | `*-schemas.ts` legacy solto | F4 começa com `rm` dos `*-schemas.ts` + merge conteúdo em `<entity>/schemas.ts`. |
| C-SUTIL-8 | F5 hooks movidos afeta F4 imports | **Ordem:** F1 → F2 → **F5 → F4** → F3. Hooks movidos antes; F4 importa `@/hooks` final. |

## Arquitetura canônica pós-F4 (redesenhada v3)

```
src/lib/actions/leads/
├── index.ts          ← SEM diretiva; re-exporta funcs + types + schemas
├── queries.ts        ← "use server" — listLeads, getLead
├── mutations.ts      ← "use server" — createLead, updateLead, deleteLead
├── bulk.ts           ← "use server" — updateLeadsStatusBulk, deleteLeadsBulk, assignLeadsBulk
├── schemas.ts        ← Zod (sem diretiva; importado por queries/mutations/bulk + types)
├── types.ts          ← TS types (importa schemas via z.infer; inverso proibido)
└── __tests__/
    ├── queries.test.ts
    ├── mutations.test.ts
    └── bulk.test.ts
```

**Public surface (v3 — inalterada):**
- `@/lib/actions/leads` → barrel neutro; consumer importa funcs + types + schemas como antes.
- Action IDs gerados apenas em `queries.ts`/`mutations.ts`/`bulk.ts` (módulos com `"use server"`). Barrel re-exporta references → Next preserva identidade única.
- Zero migration de consumers.

**Server Action contract (C-SUTIL-3):**
- Args = `FormData` ou `string | number | boolean | object` JSON-serializable.
- Closures via `.bind(null, primitives)` apenas; nunca bind de `Date`, `RefObject`, funções, classes.
- Documentado em `docs/ARCHITECTURE.md`.

## 1. Estado atual
Idêntico v1 §1.

## 2. Escopo — v3 final

### IN — 5 frentes em ordem F1 → F2 → F5 → F4 → F3

**F1. Ambiguidade `lib/<name>.ts` + `lib/<name>/`.**
- Audit pré-commit:
  - `audit-log.ts` (44 L): se é barrel de re-export, move para `audit-log/index.ts`; se tem lógica própria, integra em novo `audit-log/<sub>.ts`.
  - `email.ts` (68 L): idem.
  - `flags.ts` (2 L stub): **grep `import.*from "@/lib/flags"`** (já é o caminho de resolução para pasta); se `flags.ts` tem `export *` delegando, deletar é trivial.
- Smoke: `npx tsc --noEmit` + `npm run build` + todos os consumers continuam.

**F2. Route group legacy `(app)/settings/data-transfer`.**
- **Audit internals primeiro:**
  - `ls src/app/(app)/settings/data-transfer/` + audit hooks/useSearchParams específicos.
  - Grep `from "@/app/(app)"` — 0 consumers confirmado.
- **Mover** (não deletar) para `(protected)/settings/data-transfer/`.
- Deletar `(app)/` diretório inteiro.
- Smoke: `/settings/data-transfer` 307 em prod.

**F5. Hooks + tests padronizados — ANTES de F4.**
- `src/lib/hooks/` → `src/hooks/` (2 arquivos: `use-debounced-value.ts`, `use-saved-filters.ts`).
- Grep find-replace `@/lib/hooks/` → `@/hooks/` em todo `src/`.
- Tests: normalizar em `__tests__/` co-localizado; migrar `*.test.ts` soltos para `<module>/__tests__/<test>.test.ts`.
- Verificar `vitest.config.ts` glob `src/**/*.test.{ts,tsx}` cobre `__tests__/` (default sim).

**F4. Partição server-action files — DEPOIS de F5.**
- Aplicar em 7 entidades: `activities`, `leads`, `products`, `contacts`, `custom-attributes`, `opportunities`, `marketing-campaigns`.
- Estrutura arquivística acima.
- **Procedimento por entidade:**
  1. Criar pasta `src/lib/actions/<entity>/`.
  2. Mover conteúdo de `<entity>.ts` split conforme responsabilidade.
  3. Se existir `<entity>-schemas.ts` solto → merge em `<entity>/schemas.ts`, delete solto.
  4. Criar `index.ts` **neutro** re-exportando funcs + types + schemas.
  5. Mover tests `<entity>.test.ts` → `<entity>/__tests__/<slice>.test.ts`.
  6. `npx tsc --noEmit` + `npm run build` + `npx vitest run <entity>`.
- `index.ts` **sem** `"use server"`. Re-export pattern:
  ```ts
  // src/lib/actions/leads/index.ts
  export * from "./queries";
  export * from "./mutations";
  export * from "./bulk";
  export * from "./schemas";
  export * from "./types";
  ```
- `types.ts` importa `schemas.ts`; inverso proibido (lint rule em `.eslintrc` opcional futuro).

**F3. Decomposição dos monolitos — DEPOIS de F4.**
- 5 entidades: `products`, `leads`, `opportunities`, `tasks`, `contacts`.
- Target: nenhum arquivo >400L nessas 5.
- Estrutura arquivística:
  ```
  (protected)/<entity>/_components/
  ├── index.tsx                      ← orchestrator: CrmListShell + context + useReducer
  ├── list-view.tsx                  ← table + motion + empty
  ├── form-dialog.tsx                ← Create/Edit Dialog
  ├── delete-confirm.tsx             ← AlertDialog bulk + single
  ├── use-<entity>-filters.ts        ← filters + URL sync
  ├── context.tsx                    ← useReducer provider
  └── types.ts                       ← entity-local types
  ```
- **State sharing:** orchestrator declara context + reducer; sub-arquivos consomem `useContext`. Apenas quando callbacks drilados > 10.
- Preservation-smoke local após completar cada entidade (5× total).
- Naming: `list-view.tsx` consistente com padrão DS (Blueprint usa `<Entity>ListView` em stories).

### OUT
- FSD completo.
- `workflow-editor-content` (800L), `activity-timeline` (538L), `attr-form-dialog` (531L), `segments-list-content` (526L), `workflows-list-content` (662L).
- `src/generated/prisma/`.
- Blueprint patterns.
- Style tokens.

## 3. Invariantes preservados — v3

- 823/823 Vitest verde.
- `npm run build` ✓.
- 15 rotas Fase 34 + `/settings/data-transfer` funcionais.
- E2E golden-paths verde (E2E Prisma-shadow fail pré-existente aceito).
- **Public surface de `@/lib/actions/<entity>` 100% inalterada** (barrel neutro re-exporta tudo; funcs + types + schemas).
- Action IDs únicos (v3 C-SUTIL-1 fix).
- RBAC/tenant scope/auth/Prisma intocados.

## 4. Success criteria — v3

1. **Zero arquivos > 400L nas 5 entidades F3.**
2. **Zero ambiguidade `lib/<x>.ts` + `lib/<x>/`.**
3. **Zero `src/app/(app)/`.**
4. **Tests em `__tests__/`:** `find src/lib -name "*.test.ts" -not -path "*/__tests__/*"` → 0.
5. **`src/hooks/` existe + `src/lib/hooks/` não existe.**
6. **Vitest ≥823 verde.**
7. **Build ✓** sem novos warnings.
8. **Smoke prod 200/307** em 16 rotas (`/settings/data-transfer` incluso).
9. **Tag `fase-35-cleanup-deployed`.**
10. **Zero `"use server"` em barrels `index.ts` de actions**: grep `head -1 src/lib/actions/*/index.ts | grep "use server"` → 0 matches.
11. **Zero `*-schemas.ts` soltos em `src/lib/actions/`**: grep `ls src/lib/actions/*-schemas.ts 2>/dev/null` → 0.
12. **`src/__tests__/structural.test.ts`** existe com `test.fails()` + allowlist, amarelo no reporter.

## 5. Riscos e mitigações — v3

| # | Risco | Mitigação |
|---|---|---|
| R1 | Double-boundary barrel + arquivo `"use server"` | **v3 C-SUTIL-1:** barrel neutro; só arquivos-fonte têm `"use server"`. |
| R2 | Ciclo types↔schemas | **v3 C-SUTIL-2:** direção fixa (`types` ← `schemas`); documentado ARCHITECTURE.md. |
| R3 | Server Action args não-serializable | **v3 C-SUTIL-3:** contrato FormData/primitives; lint rule futura. |
| R4 | Rollback F4 granular | **v3 C-SUTIL-6:** squash por frente ao merge; revert atômico. |
| R5 | `*-schemas.ts` legacy duas fontes | **v3 C-SUTIL-7:** F4 começa com `rm` + merge. |
| R6 | F5 hooks invalida F4 imports | **v3 C-SUTIL-8:** F5 antes F4. |
| R7 | Preservation-smoke 18× inviável | **v3 C-SUTIL-5:** smoke por FRENTE (5 rodadas), não por commit. |
| R8 | `data-transfer` legacy internals | **v3:** audit internals + `useSearchParams` antes mover. |
| R9 | `flags.ts` stub export consumido | **v3:** grep exports antes delete; se algum, integra em `flags/index.ts`. |
| R10 | Vitest glob path | Validar após F5 (glob default cobre `__tests__/`). |
| R11 | Naming `list-view.tsx` desalinha DS | **v3:** validar padrão no Blueprint; ajustar se DS usa `*-list.tsx`. |

## 6. Estratégia de execução — v3

**Ordem:**
1. **F1** (3 sub-commits — um por par ambíguo).
2. **F2** (1 commit — mover + deletar legacy).
3. **F5** (2 sub-commits — hooks move + tests normalize).
4. **F4** (7 sub-commits — um por entidade, começando com `rm *-schemas.ts`).
5. **F3** (5 sub-commits — um por entidade).

**Total: 18 commits.**

**Checkpoint intra-frente:** `typecheck` + `build` + `vitest`.
**Checkpoint fim-de-frente:** + `playwright preservation-smoke` local (5× total ao longo das 5 frentes).

**Política merge:** squash por frente ao dar `git push origin main`. Commits granulares ficam no histórico local mas merge `main` é atomizado (5 squash commits).

**Mensagem commit pattern:** `refactor(fase-35): F<N>.<M> — <descrição>`.

## 7. Testes — v3

- `npx vitest run` após cada frente — floor 823.
- **`src/__tests__/structural.test.ts`** novo (v3 C-SUTIL-4):
  ```ts
  import { test, expect } from "vitest";
  import { readFileSync } from "node:fs";

  const monolitoLimits = [
    "src/app/(protected)/products/_components/products-content.tsx",
    "src/app/(protected)/leads/_components/leads-content.tsx",
    "src/app/(protected)/opportunities/_components/opportunities-content.tsx",
    "src/app/(protected)/tasks/_components/tasks-content.tsx",
    "src/app/(protected)/contacts/_components/contacts-content.tsx",
  ];

  for (const f of monolitoLimits) {
    test.fails(`structural: ${f} ≤ 400L`, () => {
      const lines = readFileSync(f, "utf8").split("\n").length;
      expect(lines).toBeLessThanOrEqual(400);
    });
  }
  ```
  Pós-F3 decomposição → arquivos legados deletados → tests viram skipped (arquivo não existe = falha `readFileSync`); allowlist cleanup final.
- Preservation-smoke local após **cada frente completada** (5 execuções).

## 8. Documentação — v3

- `docs/HANDOFF.md` atualizado com "Fase 35 Cleanup".
- `docs/ARCHITECTURE.md` novo:
  - Convenções de pastas (lib/, hooks/, components/, tests/).
  - Server Actions pattern: `<entity>/{index,queries,mutations,bulk,schemas,types}.ts`.
  - Barrel neutro + Server Action contract.
  - Direção schemas→types.
- Memory: `convention_code_structure.md` (**type: reference**, não "lei").
- Graphify update.

## 9. Deploy

- Push `main` → CI verde.
- Portainer force update.
- Smoke prod 16 rotas.
- Tag `fase-35-cleanup-deployed`.

## 10. Resumo executivo v3

**Principais ajustes vs v1/v2:**
1. Barrel **NEUTRO** (sem `"use server"`) — re-exporta funcs + types + schemas; public surface 100% inalterada.
2. Ordem final: **F1 → F2 → F5 → F4 → F3**.
3. Preservation-smoke por frente (5×), não por commit.
4. `structural.test.ts` com `test.fails()` + allowlist.
5. `*-schemas.ts` legacy removidos no início de F4.
6. Direção `types ← schemas` fixada.
7. Merge squash por frente.

**Pronta para:** `superpowers:writing-plans` gerar plan v1.
