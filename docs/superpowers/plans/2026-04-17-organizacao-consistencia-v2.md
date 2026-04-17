# Fase 35 Cleanup — Plan v2

> **Sub-skill:** `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.

**Spec:** `docs/superpowers/specs/2026-04-17-organizacao-consistencia-v3.md`.

**Goal:** consistência profissional do `nexus-crm-krayin` em 5 frentes F1→F2→F5→F4→F3. 22 commits.

**Diffs aplicados v2 (Review #1):**
- BUG 1 — F3 Step 5: **stub re-export fixado** (não deletar `<entity>-content.tsx` legado, re-exportar do novo).
- BUG 2 — preservation-smoke em **todas** as 5 frentes (F1, F2, F5, F4, F3).
- BUG 3 — nova **Task F4.0** dedicada `rm *-schemas.ts` legacy antes de F4.1.
- GAP 1 — MIGRATION.md incluído em Z.2.
- GAP 2 — política squash merge documentada.
- GAP 3 — seção Rollback dedicada.
- GAP 4 — timeline estimado por frente.
- GAP 5 — F5.2 lista explícita dos 53 tests soltos.

---

## Timeline estimado

| Frente | Tempo | Commits |
|---|---|---|
| F1 | ~20 min | 3 |
| F2 | ~15 min | 1 |
| F5 | ~45 min | 2 |
| F4 | ~2h30 | 8 (F4.0 + F4.1..F4.7) |
| F3 | ~1h30 | 5 |
| Z (docs+deploy) | ~40 min | 5 |
| **TOTAL** | **~6h** | **24** |

## Workflow / Squash merge

**Política:** trabalho feito diretamente em `main` com commits granulares (padrão CLAUDE.md krayin). Squash manual **não** aplicado; Rollback = `git revert <sha>` do commit específico. Justificativa: CRM atual commita em `main`, feature branches não fazem parte do fluxo. Rollback por commit é suficiente quando cada step é atômico (typecheck + build + vitest verde).

**Rollback por frente:**
- F1: `git revert <F1.1-sha> <F1.2-sha> <F1.3-sha>`.
- F2: `git revert <F2.1-sha>`.
- F5: `git revert <F5.1-sha> <F5.2-sha>`.
- F4: revert inverso da última entidade para trás; consumers de `@/lib/actions/<entity>` continuam compat porque barrel neutro preserva surface.
- F3: revert inverso; stub re-export não quebra nada ao reverter.

---

## Pré-requisitos

- Branch main limpo pós Fase 34B.
- `npx vitest run` baseline 823/823.
- `npm run build` ✓.
- `pnpm exec playwright install chromium` (uma vez).
- Preservation-smoke rodando: `npx playwright test tests/e2e/golden-paths/preservation-smoke.spec.ts --project=admin`.

---

# FRENTE 1 — Ambiguidade `lib/<name>.ts` + `lib/<name>/` (3 commits)

## Task F1.1: `audit-log`
- [ ] `cat src/lib/audit-log.ts` (44L) + inspecionar.
- [ ] Se barrel-only (`export * from`): `rm`. Se lógica própria: `git mv` conteúdo para `audit-log/utils.ts` + atualizar `audit-log/index.ts` (adicionar `export * from "./utils"`).
- [ ] `grep -rln 'from "@/lib/audit-log"' src` — confirma 9 consumers ainda resolvem.
- [ ] `npx tsc --noEmit && npm run build && npx vitest run audit-log`.
- [ ] Commit `refactor(fase-35): F1.1 — resolve ambiguidade lib/audit-log.ts`.

## Task F1.2: `email`
- [ ] Mesmo padrão. `cat src/lib/email.ts` (68L).
- [ ] 2 consumers + validação.
- [ ] Commit `refactor(fase-35): F1.2 — resolve ambiguidade lib/email.ts`.

## Task F1.3: `flags`
- [ ] `cat src/lib/flags.ts` (2L — stub `export *`). `rm src/lib/flags.ts`.
- [ ] 1 consumer + validação.
- [ ] Commit `refactor(fase-35): F1.3 — elimina flags.ts stub duplicado`.

## Smoke F1:
- [ ] `npx playwright test tests/e2e/golden-paths/preservation-smoke.spec.ts --project=admin` local.

---

# FRENTE 2 — Route group legacy (1 commit)

## Task F2.1: Mover `(app)/settings/data-transfer`
- [ ] `ls src/app/(app)/settings/data-transfer/` — inventário.
- [ ] `grep -rln 'from "@/app/(app)"' src` → 0 esperado.
- [ ] Audit `useSearchParams`/`useParams`/`usePathname` internos — rota stays `/settings/data-transfer`.
- [ ] `git mv src/app/\(app\)/settings/data-transfer src/app/\(protected\)/settings/data-transfer`.
- [ ] `rm -rf src/app/\(app\)` (vazio).
- [ ] `npx tsc --noEmit && npm run build`.
- [ ] `npm run dev & sleep 6 && /usr/bin/curl -sk -o /dev/null -w '%{http_code}' http://localhost:3000/settings/data-transfer && kill %1` → 307.
- [ ] Commit `refactor(fase-35): F2.1 — move (app)/settings/data-transfer → (protected)/`.

## Smoke F2:
- [ ] `npx playwright test ... preservation-smoke.spec.ts` local.

---

# FRENTE 5 — Hooks + tests padronizados (2 commits) — ANTES de F4

## Task F5.1: `src/lib/hooks/` → `src/hooks/`
- [ ] `mkdir -p src/hooks && git mv src/lib/hooks/*.ts src/hooks/ && rmdir src/lib/hooks`.
- [ ] Find-replace: `grep -rl '@/lib/hooks/' src | xargs sed -i '' 's|@/lib/hooks/|@/hooks/|g'`.
- [ ] `npx tsc --noEmit && npm run build && npx vitest run`.
- [ ] Commit `refactor(fase-35): F5.1 — hooks migrated to @/hooks (Next 15+ convention)`.

## Task F5.2: Tests soltos → `__tests__/`

**Arquivos alvo (53 total):**

Grupo A — `src/lib/actions/*.test.ts` (14 arquivos, ficam em `src/lib/actions/__tests__/` **temporário** até F4 mover para `<entity>/__tests__/`):
```
mailboxes.test.ts, custom-attributes.test.ts, contacts.custom.test.ts,
products.test.ts, opportunities.tenant.test.ts, leads.tenant.test.ts,
marketing-campaigns.test.ts, leads.custom.test.ts, opportunities.custom.test.ts,
marketing-segments.test.ts, activities.test.ts, workflows.test.ts,
contacts.tenant.test.ts
```
(nota: vão ser redistribuídos em F4; agora só organizar transitoriamente).

Grupo B — testes já dentro de módulos específicos (37 arquivos), mover para `__tests__/` dentro do próprio módulo:

```
src/lib/filters/custom-parser.test.ts → src/lib/filters/__tests__/
src/lib/rbac/{custom-attrs-permissions,rbac}.test.ts → src/lib/rbac/__tests__/
src/lib/crypto/aes-gcm.test.ts → src/lib/crypto/__tests__/
src/lib/flags/resolve.test.ts → src/lib/flags/__tests__/
src/lib/custom-attributes/*.test.ts (7) → src/lib/custom-attributes/__tests__/
src/lib/search/*.test.ts (3) → src/lib/search/__tests__/
src/lib/adapters/settings/*.test.ts (2) → src/lib/adapters/settings/__tests__/
src/lib/adapters/profile/*.test.ts (1) → src/lib/adapters/profile/__tests__/
src/lib/consent/*.test.ts (2) → src/lib/consent/__tests__/
src/lib/dsar/*.test.ts (2) → src/lib/dsar/__tests__/
src/lib/files/*.test.ts (2) → src/lib/files/__tests__/
src/lib/marketing/*.test.ts (2) → src/lib/marketing/__tests__/
src/lib/automation/*.test.ts (3) → src/lib/automation/__tests__/
src/lib/automation/actions/actions.test.ts → src/lib/automation/actions/__tests__/
src/lib/worker/processors/*.test.ts (4) → src/lib/worker/processors/__tests__/
src/lib/worker/boot.test.ts → src/lib/worker/__tests__/
src/lib/worker/queues/*.test.ts (2) → src/lib/worker/queues/__tests__/
src/lib/currency/allowlist.test.ts → src/lib/currency/__tests__/
src/lib/email/tokens.test.ts → src/lib/email/__tests__/
src/lib/logger.test.ts → src/lib/__tests__/ (root)
```

**Script one-shot:**
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
# Grupo B: iterate dir por dir
declare -a dirs=("filters" "rbac" "crypto" "flags" "custom-attributes" "search" "adapters/settings" "adapters/profile" "consent" "dsar" "files" "marketing" "automation" "automation/actions" "worker" "worker/processors" "worker/queues" "currency" "email")
for d in "${dirs[@]}"; do
  mkdir -p "src/lib/$d/__tests__"
  for f in src/lib/$d/*.test.ts; do
    [ -f "$f" ] && git mv "$f" "src/lib/$d/__tests__/"
  done
done
# Logger.test.ts (root lib)
mkdir -p src/lib/__tests__
git mv src/lib/logger.test.ts src/lib/__tests__/ 2>/dev/null || true
# Grupo A: actions/__tests__ transitório
mkdir -p src/lib/actions/__tests__
for f in src/lib/actions/*.test.ts; do
  [ -f "$f" ] && git mv "$f" src/lib/actions/__tests__/
done
```

- [ ] Rodar script acima.
- [ ] `npx vitest run` — glob `src/**/*.test.{ts,tsx}` cobre automático.
- [ ] `npx tsc --noEmit && npm run build`.
- [ ] Commit `refactor(fase-35): F5.2 — tests normalized to __tests__/ per module (53 files)`.

## Smoke F5:
- [ ] Preservation-smoke local.

---

# FRENTE 4 — Partição server-action files (8 commits) — DEPOIS de F5

## Task F4.0: Clean `*-schemas.ts` legacy

- [ ] `ls src/lib/actions/*-schemas.ts` — lista: `activities-schemas.ts`, `mailboxes-schemas.ts`, `marketing-campaigns-schemas.ts`, `marketing-segments-schemas.ts` (esperado; confirmar com ls real).
- [ ] Para cada arquivo `<entity>-schemas.ts` cujo `<entity>` **NÃO** é parte de F4 (ex: `mailboxes`, `marketing-segments`): manter como está (fora do escopo F4).
- [ ] Para os que são F4 (`activities-schemas`, `marketing-campaigns-schemas`): **mantém por ora**; conteúdo será migrado para `<entity>/schemas.ts` durante F4.<N> respectiva + `rm <entity>-schemas.ts` no mesmo commit.
- [ ] Essa task F4.0 é APENAS documentação/audit — sem alteração.
- [ ] Registrar em `docs/MIGRATION.md` (created em Z.2) que `<entity>-schemas.ts` serão deletados nas respectivas F4.<N>.

## Task F4.1..F4.7: Partitioning por entidade

**Template comum:**

1. **Setup** — `mkdir -p src/lib/actions/<entity>/__tests__`.
2. **Split** — ler `<entity>.ts` + particionar em `queries.ts`/`mutations.ts`/`bulk.ts`/`schemas.ts`/`types.ts`. Cada `queries/mutations/bulk` começa com `"use server"`; `schemas/types` NÃO tem diretiva.
3. **Schemas legacy merge** — se existe `src/lib/actions/<entity>-schemas.ts`: merge conteúdo em `<entity>/schemas.ts` + `rm <entity>-schemas.ts`.
4. **Barrel neutro** — criar `<entity>/index.ts`:
   ```ts
   // src/lib/actions/<entity>/index.ts
   // Barrel NEUTRO (sem "use server"). Re-export preserva public surface.
   export * from "./queries";
   export * from "./mutations";
   export * from "./bulk";
   export * from "./schemas";
   export * from "./types";
   ```
5. **Tests migrate** — mover `src/lib/actions/__tests__/<entity>*.test.ts` (vindos de F5.2) → `src/lib/actions/<entity>/__tests__/`. Split por `queries.test.ts`/`mutations.test.ts`/`bulk.test.ts` quando apropriado; manter arquivo único caso não seja trivial.
6. **Delete legacy** — `rm src/lib/actions/<entity>.ts`.
7. **Checks** — `npx tsc --noEmit && npm run build && npx vitest run <entity>`.
8. **Commit** — `refactor(fase-35): F4.<N> — split <entity> em queries/mutations/bulk/schemas/types (barrel neutro)`.

**Ordem (menores primeiro):**
- F4.1 `custom-attributes` (483L)
- F4.2 `marketing-campaigns` (457L) + merge `marketing-campaigns-schemas.ts`
- F4.3 `opportunities` (467L)
- F4.4 `contacts` (486L)
- F4.5 `products` (599L)
- F4.6 `leads` (638L)
- F4.7 `activities` (920L) + merge `activities-schemas.ts`

## Smoke F4:
- [ ] Preservation-smoke local pós F4.7.

---

# FRENTE 3 — Decomposição monolitos (5 commits) — DEPOIS de F4

## Task F3.1..F3.5: Decompose monolito por entidade

**Template (BUG 1 fix — stub re-export fixado):**

1. **Setup** — `mkdir -p src/app/(protected)/<entity>/_components/<entity>`.
2. **Split** do arquivo `<entity>-content.tsx`:
   - `context.tsx` — `useReducer` + `<EntityContext>` provider.
   - `list-view.tsx` — tabela + motion + empty state.
   - `form-dialog.tsx` — Dialog Create/Edit.
   - `delete-confirm.tsx` — AlertDialog bulk + single.
   - `use-<entity>-filters.ts` — filters + URL sync.
   - `types.ts` — entity-local types.
   - `index.tsx` — orchestrator: `<EntityProvider>` + `<CrmListShell>` + composição dos sub.
3. **Stub re-export legado** — NÃO deletar `<entity>-content.tsx`. Substituir por:
   ```tsx
   // src/app/(protected)/<entity>/_components/<entity>-content.tsx
   export { <Entity>Content } from "./<entity>";
   ```
   Preserva todos os imports externos de `./_components/<entity>-content`.
4. **Checks** — `npx tsc --noEmit && npm run build && npx vitest run <entity>`.
5. **Linha count** — `wc -l src/app/(protected)/<entity>/_components/<entity>/*.tsx` — nenhum > 400L.
6. **Preservation-smoke local** — `npx playwright test ... preservation-smoke.spec.ts --project=admin`.
7. **Commit** — `refactor(fase-35): F3.<N> — decomposição monolito <entity>-content em sub-arquivos <400L`.

**Ordem (menores primeiro):**
- F3.1 `contacts` (869L)
- F3.2 `tasks` (997L)
- F3.3 `opportunities` (1056L)
- F3.4 `leads` (1057L)
- F3.5 `products` (1245L)

## Smoke F3:
- [ ] Preservation-smoke final após F3.5.

---

# Pós-frentes: deploy + docs + memory

## Task Z.1: structural.test.ts

- [ ] Criar `src/__tests__/structural.test.ts`:
   ```ts
   import { test, expect } from "vitest";
   import { readFileSync, existsSync } from "node:fs";

   const F3_TARGETS = [
     "src/app/(protected)/products/_components/products/index.tsx",
     "src/app/(protected)/leads/_components/leads/index.tsx",
     "src/app/(protected)/opportunities/_components/opportunities/index.tsx",
     "src/app/(protected)/tasks/_components/tasks/index.tsx",
     "src/app/(protected)/contacts/_components/contacts/index.tsx",
   ];

   for (const f of F3_TARGETS) {
     test(`structural: ${f} ≤ 400L`, () => {
       if (!existsSync(f)) return; // skip se ainda não existe
       const lines = readFileSync(f, "utf8").split("\n").length;
       expect(lines).toBeLessThanOrEqual(400);
     });
   }

   test("structural: zero src/lib/<name>.ts + src/lib/<name>/ ambiguidade", () => {
     const { readdirSync, statSync } = require("node:fs");
     const libDir = "src/lib";
     const entries = readdirSync(libDir);
     const files = new Set(entries.filter(e => e.endsWith(".ts")).map(e => e.replace(".ts", "")));
     const dirs = new Set(entries.filter(e => statSync(`${libDir}/${e}`).isDirectory()));
     const ambiguous = [...files].filter(f => dirs.has(f));
     expect(ambiguous).toEqual([]);
   });

   test("structural: zero *-schemas.ts soltos em src/lib/actions/", () => {
     const { readdirSync } = require("node:fs");
     const stray = readdirSync("src/lib/actions").filter(e => e.endsWith("-schemas.ts"));
     expect(stray).toEqual([]);
   });
   ```
- [ ] `npx vitest run structural` — todos verde.
- [ ] Commit `test(fase-35): structural.test.ts enforcement`.

## Task Z.2: ARCHITECTURE.md + MIGRATION.md + HANDOFF

- [ ] Criar `docs/ARCHITECTURE.md`:
  ```md
  # Arquitetura — Nexus CRM Krayin

  ## Convenções de pastas
  - `src/app/` — Next.js App Router (route groups `(protected)` + `(auth)`).
  - `src/components/` — componentes de UI de domínio CRM, organizados por feature.
  - `src/lib/<domain>/` — lógica de negócio por domínio (um único nome, sem arquivo solto homônimo).
  - `src/hooks/` — custom hooks reutilizáveis (Next 15+ convention).
  - `src/lib/actions/<entity>/` — Server Actions por entidade.

  ## Server Actions pattern
  - Cada entidade vira pasta `src/lib/actions/<entity>/`.
  - Estrutura: `index.ts` (barrel neutro) + `queries.ts` + `mutations.ts` + `bulk.ts` + `schemas.ts` + `types.ts` + `__tests__/`.
  - `queries.ts` / `mutations.ts` / `bulk.ts` começam com `"use server"`.
  - `schemas.ts` / `types.ts` SEM diretiva.
  - `index.ts` barrel SEM `"use server"` — re-exporta funcs + types + schemas.
  - Direção: `types.ts` importa de `schemas.ts` via `z.infer`; inverso proibido.
  - Args de Server Actions: FormData ou primitives/JSON-serializable. Closures via `.bind()` só com primitives.

  ## Testes
  - Co-localizados em `__tests__/` dentro do módulo pai.
  - Glob vitest: `src/**/*.test.{ts,tsx}`.
  - `src/__tests__/structural.test.ts` valida convenções estruturais.

  ## Hooks
  - `src/hooks/` — hooks globais reutilizáveis.
  - Hooks específicos de domínio ficam em `src/lib/<domain>/hooks/` ou no `_components/` da rota.

  ## Route groups
  - `(protected)` — rotas autenticadas.
  - `(auth)` — login/logout/recovery.
  - Evitar route groups adicionais ad hoc.
  ```
- [ ] Criar `docs/MIGRATION.md`:
  ```md
  # Migration Guide — Fase 35 Cleanup

  ## F1: lib/<name>.ts resolved
  Sem impacto nos consumers. Paths `@/lib/audit-log`, `@/lib/email`, `@/lib/flags` continuam válidos (resolvem para o `index.ts` da pasta).

  ## F2: Route group moved
  `/settings/data-transfer` URL stays; internamente passa a morar em `(protected)/`.

  ## F5: Hooks
  Consumer: `@/lib/hooks/...` → `@/hooks/...` (find-replace automático).

  ## F4: Server Actions partition
  Public surface 100% preservada via barrel neutro.
  - `@/lib/actions/leads` continua re-exportando funcs + types + schemas.
  - Imports novos preferenciais (opcional, mais explícitos):
    - `@/lib/actions/leads/queries`, `.../mutations`, `.../bulk` (só funcs).
    - `@/lib/actions/leads/schemas` (só schemas Zod).
    - `@/lib/actions/leads/types` (só types TS).

  ## F3: Decomposição
  `<entity>-content.tsx` agora stub re-export de `./<entity>/index.tsx`. Consumers de `./_components/<entity>-content` continuam válidos.
  ```
- [ ] Atualizar `docs/HANDOFF.md` com entrada Fase 35 Cleanup.
- [ ] Commit `docs(fase-35): ARCHITECTURE + MIGRATION + HANDOFF`.

## Task Z.3: Memory + graphify

- [ ] Criar `~/.claude/projects/-Users-joaovitorzanini-Developer-Claude-Code-nexus-crm-krayin/memory/convention_code_structure.md`:
  ```md
  ---
  name: Convenção — estrutura de código nexus-crm-krayin
  description: Pós Fase 35 Cleanup (2026-04-17). Convenções estruturais do krayin: src/hooks/, src/lib/<domain>/, server actions em <entity>/{index,queries,mutations,bulk,schemas,types}.ts com barrel neutro. Tests em __tests__/ co-localizado. Detalhes em docs/ARCHITECTURE.md.
  type: reference
  ---
  (body com regras e justificativas)
  ```
- [ ] Atualizar `MEMORY.md` index.
- [ ] `graphify update .` em krayin.
- [ ] Commit `chore(graphify): pós Fase 35`.

## Task Z.4: Push + deploy

- [ ] `git push origin main`.
- [ ] CI Build+Push+Security verde.
- [ ] Portainer force update.
- [ ] Smoke prod 16 rotas + `/settings/data-transfer`.
- [ ] Tag `fase-35-cleanup-deployed` + push.

---

## Rollback strategy

**Rollback atômico por commit:** cada sub-commit (F1.1, F2.1, F4.3, F3.2, etc.) é typecheck+build+vitest verde isolado. Reverter = `git revert <sha>` + push.

**Rollback de frente inteira:** `git log --oneline --grep="refactor(fase-35): F<N>"` + revert em ordem reversa. Ex: F3 = revert F3.5 → F3.4 → F3.3 → F3.2 → F3.1.

**Rollback cross-frente (F4 depende de F5):** se F4 entidades já migraram, revert de F5.1/F5.2 requer `sed` inverso `@/hooks/` → `@/lib/hooks/` + recreate `src/lib/hooks/`. Mais trabalhoso; evitar.

**Rollback de prod pós-deploy:** `git revert <fase-35-cleanup-deployed-sha>` + push + Portainer redeploy.

---

## Resumo entregáveis

- [ ] F1.1, F1.2, F1.3 + smoke
- [ ] F2.1 + smoke
- [ ] F5.1, F5.2 + smoke
- [ ] F4.0, F4.1..F4.7 + smoke
- [ ] F3.1..F3.5 + smoke
- [ ] Z.1 structural.test
- [ ] Z.2 ARCHITECTURE + MIGRATION + HANDOFF
- [ ] Z.3 memory + graphify
- [ ] Z.4 push + deploy + tag

**Total: 24 commits.**

**Status:** plan v2 pronto para Review #2 pente fino → v3 → execução.
