# Fase 35 Cleanup — Plan v1

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA — `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.

**Spec:** `docs/superpowers/specs/2026-04-17-organizacao-consistencia-v3.md`.

**Goal:** Consistência profissional do `nexus-crm-krayin` em 5 frentes (F1→F2→F5→F4→F3). 18 commits agrupados; squash por frente ao merge.

**Invariants:** zero regressão visual/funcional/test; public surface actions inalterada (barrel neutro).

---

## Pré-requisitos
- Branch main limpo pós Fase 34B.
- `npx vitest run` baseline 823/823.
- `npm run build` ✓ baseline.

---

# FRENTE 1 — Ambiguidade `lib/<name>.ts` + `lib/<name>/` (3 commits)

## Task F1.1: `audit-log.ts` + `audit-log/`

- [ ] Step 1: `cat src/lib/audit-log.ts` (44L). Se apenas `export * from "./audit-log/index"` → deletar. Se tem lógica própria, move para `audit-log/index.ts`.
- [ ] Step 2: `grep -rln 'from "@/lib/audit-log"' src` — 9 consumers. Validar que nenhum usa `.ts` explícito.
- [ ] Step 3: Deletar/mover arquivo. `rm src/lib/audit-log.ts` se barrel-only.
- [ ] Step 4: `npx tsc --noEmit` + `npm run build` + `npx vitest run audit-log`.
- [ ] Step 5: Commit `refactor(fase-35): F1.1 — resolve ambiguidade lib/audit-log.ts vs lib/audit-log/`.

## Task F1.2: `email.ts` + `email/`

- [ ] Step 1-5: mesmo padrão. `cat src/lib/email.ts` (68L); se tem lógica (helpers, constants), integra em `email/index.ts` ou arquivo dedicado.
- [ ] Validar 2 consumers.
- Commit `refactor(fase-35): F1.2 — resolve ambiguidade lib/email.ts`.

## Task F1.3: `flags.ts` + `flags/`

- [ ] Step 1: `cat src/lib/flags.ts` (2L — stub). Confirmar `export *` delegando.
- [ ] Step 2: Validar 1 consumer.
- [ ] Step 3: `rm src/lib/flags.ts`.
- [ ] Step 4-5: checks + commit.

---

# FRENTE 2 — Route group legacy (1 commit)

## Task F2.1: Mover `(app)/settings/data-transfer` → `(protected)/settings/data-transfer`

- [ ] Step 1: `ls src/app/(app)/settings/data-transfer/` — inventário de arquivos.
- [ ] Step 2: `grep -rln 'from "@/app/(app)"' src` — 0 esperado.
- [ ] Step 3: Audit `useSearchParams`, `useParams`, `usePathname` internos — nenhum path-specific (rota stays `/settings/data-transfer`).
- [ ] Step 4: `git mv src/app/\(app\)/settings/data-transfer src/app/\(protected\)/settings/data-transfer`.
- [ ] Step 5: `rm -rf src/app/\(app\)` (vazio pós move).
- [ ] Step 6: `npx tsc --noEmit` + `npm run build`.
- [ ] Step 7: `npm run dev` + `curl /settings/data-transfer -I` → 200 ou 307.
- [ ] Step 8: Commit `refactor(fase-35): F2.1 — move (app)/settings/data-transfer → (protected)/ e elimina route group legacy`.

---

# FRENTE 5 — Hooks + tests padronizados (2 commits) — ANTES de F4

## Task F5.1: `src/lib/hooks/` → `src/hooks/`

- [ ] Step 1: `mkdir -p src/hooks && git mv src/lib/hooks/use-debounced-value.ts src/hooks/ && git mv src/lib/hooks/use-saved-filters.ts src/hooks/`.
- [ ] Step 2: `rmdir src/lib/hooks` (se vazio).
- [ ] Step 3: Find-replace `@/lib/hooks/` → `@/hooks/`:
  ```sh
  grep -rln '@/lib/hooks/' src | xargs sed -i '' 's|@/lib/hooks/|@/hooks/|g'
  ```
- [ ] Step 4: `npx tsc --noEmit` + `npm run build` + `npx vitest run`.
- [ ] Step 5: Commit `refactor(fase-35): F5.1 — hooks migrated to @/hooks (Next 15+ convention)`.

## Task F5.2: Tests normalizados em `__tests__/`

- [ ] Step 1: Inventário `find src/lib -name "*.test.ts" -not -path "*/__tests__/*"`.
- [ ] Step 2: Para cada test solto (ex: `src/lib/marketing/unsubscribe-token.test.ts`):
  ```sh
  mkdir -p src/lib/marketing/__tests__
  git mv src/lib/marketing/unsubscribe-token.test.ts src/lib/marketing/__tests__/unsubscribe-token.test.ts
  ```
- [ ] Step 3: Idem para `src/lib/actions/*.test.ts` (os que ficaram fora de pastas F4).
- [ ] Step 4: `npx vitest run` — glob `src/**/*.test.{ts,tsx}` cobre automático.
- [ ] Step 5: Commit `refactor(fase-35): F5.2 — tests normalized to __tests__/ per module`.

---

# FRENTE 4 — Partição server-action files (7 commits) — DEPOIS de F5

**Template por entidade** (aplicar a: activities, leads, products, contacts, custom-attributes, opportunities, marketing-campaigns):

## Task F4.<entity>: partitioning

- [ ] Step 1: `mkdir -p src/lib/actions/<entity>/__tests__`.
- [ ] Step 2: Ler `src/lib/actions/<entity>.ts` + identificar secções:
  - Queries (list/get/search): → `queries.ts` com `"use server"`.
  - Mutations (create/update/delete): → `mutations.ts` com `"use server"`.
  - Bulk (updateXBulk, deleteXBulk, assignXBulk): → `bulk.ts` com `"use server"`.
  - Zod schemas: → `schemas.ts` (sem diretiva).
  - TS types + interfaces (`<Entity>Item`, `<Entity>Filters`): → `types.ts` (sem diretiva; `z.infer<>` quando deriva de schema).
- [ ] Step 3: Se existir `<entity>-schemas.ts` solto em `src/lib/actions/` → merge conteúdo em `<entity>/schemas.ts`; `rm <entity>-schemas.ts`.
- [ ] Step 4: Criar `src/lib/actions/<entity>/index.ts` barrel **NEUTRO**:
  ```ts
  // NÃO declarar "use server" aqui — barrel neutro.
  export * from "./queries";
  export * from "./mutations";
  export * from "./bulk";
  export * from "./schemas";
  export * from "./types";
  ```
- [ ] Step 5: Mover testes `<entity>.test.ts` → `<entity>/__tests__/<slice>.test.ts` (split por arquivo se apropriado).
- [ ] Step 6: `rm src/lib/actions/<entity>.ts`.
- [ ] Step 7: `npx tsc --noEmit` + `npm run build` + `npx vitest run <entity>` verde.
- [ ] Step 8: Commit `refactor(fase-35): F4.<N> — split <entity> actions em queries/mutations/bulk/schemas/types`.

**Entidades (ordem sugerida, menores primeiro):**
- F4.1: `custom-attributes` (483L).
- F4.2: `marketing-campaigns` (457L).
- F4.3: `opportunities` (467L).
- F4.4: `contacts` (486L).
- F4.5: `products` (599L).
- F4.6: `leads` (638L).
- F4.7: `activities` (920L — última, mais complexa).

**Checkpoint pós-F4 completo:**
- [ ] `npm run build` + `npx vitest run` + `npx playwright test tests/e2e/golden-paths/preservation-smoke.spec.ts`.

---

# FRENTE 3 — Decomposição monolitos (5 commits) — DEPOIS de F4

**Template por entidade** (aplicar a: products, leads, opportunities, tasks, contacts):

## Task F3.<entity>: decompose monolito

- [ ] Step 1: `mkdir -p src/app/(protected)/<entity>/_components/<entity>`.
- [ ] Step 2: Ler `<entity>-content.tsx` + identificar secções:
  - Imports + hooks globais → ficam no orchestrator `index.tsx`.
  - `useReducer` state + dispatch: extrair para `context.tsx`.
  - Render tabela + motion + empty state: → `list-view.tsx`.
  - Dialog Create/Edit: → `form-dialog.tsx`.
  - AlertDialog bulk + single delete: → `delete-confirm.tsx`.
  - Filters + URL sync (useEffect): → `use-<entity>-filters.ts`.
  - Types locais: → `types.ts`.
- [ ] Step 3: Escrever `index.tsx` orchestrator:
  ```tsx
  "use client";
  import { CrmListShell } from "@nexusai360/patterns";
  import { <Entity>Provider } from "./context";
  import { ListView } from "./list-view";
  import { FormDialog } from "./form-dialog";
  import { DeleteConfirm } from "./delete-confirm";

  export function <Entity>Content(props) {
    return (
      <<Entity>Provider {...props}>
        <CrmListShell title=... icon=... breadcrumbs=... actions=...>
          <ListView />
          <FormDialog />
          <DeleteConfirm />
        </CrmListShell>
      </<Entity>Provider>
    );
  }
  ```
- [ ] Step 4: Cada sub-arquivo `"use client"` + consome `use<Entity>Context()`.
- [ ] Step 5: Deletar `<entity>-content.tsx` legado; renomear `index.tsx` para o novo entrypoint (ou mover `<entity>-content.tsx` resolve pra `<entity>/index.tsx`).
  - Alternativa mais segura: manter `_components/<entity>-content.tsx` como stub re-exportando `./<entity>/index.tsx`:
    ```tsx
    export { <Entity>Content } from "./<entity>";
    ```
- [ ] Step 6: `npx tsc --noEmit` + `npm run build`.
- [ ] Step 7: `npx vitest run <entity>`.
- [ ] Step 8: `npx playwright test tests/e2e/golden-paths/preservation-smoke.spec.ts` local.
- [ ] Step 9: Confirmar que arquivos sub ≤ 400L cada via `wc -l`.
- [ ] Step 10: Commit `refactor(fase-35): F3.<N> — decomposição monolito <entity>-content em sub-arquivos <400L`.

**Entidades (ordem):**
- F3.1: `contacts` (869L — menor monolito).
- F3.2: `tasks` (997L).
- F3.3: `opportunities` (1056L).
- F3.4: `leads` (1057L).
- F3.5: `products` (1245L — maior).

---

# Pós-frentes: deploy + docs + memory

## Task Z.1: structural.test.ts

- [ ] Criar `src/__tests__/structural.test.ts` conforme spec v3 §7 (test.fails allowlist).
- [ ] `npx vitest run structural` — amarelo/skipped conforme estado.
- [ ] Commit `test(fase-35): structural.test.ts warning-only enforcement`.

## Task Z.2: ARCHITECTURE.md + MIGRATION.md + HANDOFF

- [ ] Criar `docs/ARCHITECTURE.md` com convenções (pastas, naming, server actions pattern, hooks, tests).
- [ ] Atualizar `docs/HANDOFF.md` entrada Fase 35.
- [ ] Commit `docs(fase-35): ARCHITECTURE.md + HANDOFF atualizado`.

## Task Z.3: Memory + graphify

- [ ] Criar `~/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-crm-krayin/memory/convention_code_structure.md` (type: reference).
- [ ] Atualizar MEMORY.md index.
- [ ] `graphify update .` em krayin.
- [ ] Commit `chore(graphify): pós Fase 35`.

## Task Z.4: Push + deploy

- [ ] `git push origin main`.
- [ ] Monitorar CI Build+Push+Security.
- [ ] Portainer force update service.
- [ ] Smoke prod 16 rotas.
- [ ] Tag `fase-35-cleanup-deployed`.
- [ ] `git push origin fase-35-cleanup-deployed`.

---

## Resumo entregáveis

- [ ] F1.1, F1.2, F1.3 — 3 ambiguidades resolvidas
- [ ] F2.1 — legacy route movida
- [ ] F5.1, F5.2 — hooks + tests normalizados
- [ ] F4.1..F4.7 — 7 entities split
- [ ] F3.1..F3.5 — 5 monolitos decompostos
- [ ] Z.1, Z.2, Z.3, Z.4 — docs + memory + graphify + deploy

**Total: 22 commits (5 adicionais pós-frente).**

---

**Status:** plan v1 pronto para Review #1 (code-reviewer) → v2 → Review #2 → v3 → execução.
