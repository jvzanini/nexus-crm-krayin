# Fase 35 Cleanup — Plan v3 FINAL

> **Sub-skill:** `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.

**Spec:** `docs/superpowers/specs/2026-04-17-organizacao-consistencia-v3.md` (com patch §6 C-SUTIL-6 commits granulares).

**Goal:** consistência profissional do `nexus-crm-krayin` em 5 frentes F1→F2→F5→F4→F3. **23 commits granulares em `main`**.

**Diffs v3 (Review #2 plan):**
- (2) F5.2 **remove Grupo A** — actions tests ficam em `src/lib/actions/` aguardando F4 mover direto (evita duplo move).
- (3) F4.0 task simplificada (sem referência a MIGRATION.md pré-existente).
- (5) F4.7 activities: `uploadFile`/`downloadFile` → `files.ts`; `getAssignableUsers` → `queries.ts`.
- (6) F3 stub: garantir named export `<Entity>Content` + se consumer usa default, adicionar re-export default.
- (9) structural.test.ts: imports top-level único.
- (10) Preservation-smoke: `playwright.config.ts` já tem `webServer` auto; documentar uso.
- (4/8) F4 Step 2 sub-steps granulares 2a-2e.
- (7) F3 gate "callbacks > 10" para context.tsx.
- (11) F4 timing ajustado 3h15 (F4.7 ~50min).
- (13) Squash removido — alinhado spec (commits granulares).
- (14) Bridge stub documentado no MIGRATION.md.

---

## Timeline estimado

| Frente | Tempo | Commits |
|---|---|---|
| F1 | 20 min | 3 |
| F2 | 15 min | 1 |
| F5 | 30 min | 2 |
| F4 | 3h15 | 8 (F4.0 + F4.1..F4.7) |
| F3 | 1h45 | 5 |
| Z | 40 min | 4 |
| **TOTAL** | **~6h35** | **23** |

## Workflow

Commits diretos em `main` (prática krayin). Rollback atômico por sub-commit via `git revert <sha>`. Sem feature branch, sem squash.

---

## Pré-requisitos

- Branch main limpo pós Fase 34B.
- `npx vitest run` baseline 823/823.
- `npm run build` ✓ baseline.
- `npx playwright install chromium` (uma vez).
- Preservation-smoke comando canônico: `npx playwright test tests/e2e/golden-paths/preservation-smoke.spec.ts --project=admin` — `playwright.config.ts` tem `webServer.command: 'npm run dev'` + `reuseExistingServer: true`, então auto-start do server em dev. Se estiver rodando `npm run dev` em outro terminal, reusa.

---

# FRENTE 1 — Ambiguidade `lib/<name>.ts` + `lib/<name>/` (3 commits)

Idêntico plan v2 §F1. Commits:
- F1.1: `audit-log`.
- F1.2: `email`.
- F1.3: `flags`.

**Smoke F1:** `npx playwright test ... preservation-smoke.spec.ts --project=admin`.

---

# FRENTE 2 — Route group legacy (1 commit)

Idêntico plan v2 §F2.1. **Smoke F2:** preservation-smoke local.

---

# FRENTE 5 — Hooks + tests padronizados (2 commits)

## Task F5.1: `src/lib/hooks/` → `src/hooks/`
Idêntico plan v2.

## Task F5.2: Tests soltos → `__tests__/` — **APENAS Grupo B** (v3 fix #2)

Remove Grupo A (actions tests). 39 arquivos do Grupo B migram.

Script one-shot:
```sh
cd "/Users/joaovitorzanini/Developer/Claude Code/nexus-crm-krayin"
declare -a dirs=("filters" "rbac" "crypto" "flags" "custom-attributes" "search" "adapters/settings" "adapters/profile" "consent" "dsar" "files" "marketing" "automation" "automation/actions" "worker" "worker/processors" "worker/queues" "currency" "email")
for d in "${dirs[@]}"; do
  mkdir -p "src/lib/$d/__tests__"
  for f in src/lib/$d/*.test.ts; do
    [ -f "$f" ] && git mv "$f" "src/lib/$d/__tests__/"
  done
done
mkdir -p src/lib/__tests__
git mv src/lib/logger.test.ts src/lib/__tests__/ 2>/dev/null || true
# Grupo A (actions tests) NÃO MOVE — F4 move direto.
```

- [ ] Rodar script.
- [ ] `npx vitest run`.
- [ ] `npx tsc --noEmit && npm run build`.
- [ ] Commit `refactor(fase-35): F5.2 — tests normalized to __tests__/ per module (39 files Grupo B)`.

**Smoke F5:** preservation-smoke local.

---

# FRENTE 4 — Partição server-action files (8 commits)

## Task F4.0: Audit `*-schemas.ts` legacy (0 arquivos afetados, doc-only)

- [ ] `ls src/lib/actions/*-schemas.ts` — lista.
- [ ] Decidir: cada `<entity>-schemas.ts` cujo `<entity>` ∈ F4 → será merged no `<entity>/schemas.ts` respectivo durante F4.<N>. Fora F4 → mantém solto.
- [ ] **Zero mudança** nesta task. Apenas registrar plano inline (não em MIGRATION.md — esse arquivo nasce em Z.2).
- [ ] Commit não aplicável (sem diff).

## Task F4.1..F4.7: Partitioning por entidade

**Template (sub-steps granulares v3 fix #4):**

1. **Setup** — `mkdir -p src/lib/actions/<entity>/__tests__`.
2a. **Extract queries** — ler `<entity>.ts` + mover funcs leitura (`listX`, `getX`, `searchX`) para `queries.ts` com `"use server"` no topo.
2b. **Extract mutations** — mover `createX`, `updateX`, `deleteX` para `mutations.ts` com `"use server"`.
2c. **Extract bulk** — mover `updateXBulk`, `deleteXBulk`, `assignXBulk` para `bulk.ts` com `"use server"`.
2d. **Extract schemas** — Zod schemas para `schemas.ts` (sem diretiva). Se existe `<entity>-schemas.ts` solto: merge conteúdo + `rm <entity>-schemas.ts`.
2e. **Extract types** — TS types/interfaces para `types.ts` (sem diretiva). Importa `schemas.ts` via `z.infer` quando possível (direção v3 spec).
2f. **Helpers (se aplicável)** — funções utilitárias não categorizadas vão para `<entity>/helpers.ts` com `"use server"`. Ex: `activities`: `uploadFile`, `downloadFile` → `files.ts` com `"use server"`. `getAssignableUsers` → mantém em `queries.ts`.
3. **Barrel neutro** — `index.ts`:
   ```ts
   // Barrel NEUTRO (sem "use server"). Re-exporta funcs + types + schemas.
   export * from "./queries";
   export * from "./mutations";
   export * from "./bulk";
   export * from "./schemas";
   export * from "./types";
   ```
   (+ `export * from "./files"` / `"./helpers"` quando aplicável).
4. **Tests migrate** — move `src/lib/actions/<entity>*.test.ts` + `<entity>.tenant.test.ts` + `<entity>.custom.test.ts` → `<entity>/__tests__/`. Split por slice (queries/mutations/bulk) quando trivial; senão mantém arquivo único.
5. **Delete legacy** — `rm src/lib/actions/<entity>.ts`.
6. **Checks** — `npx tsc --noEmit && npm run build && npx vitest run <entity>`.
7. **Commit** — `refactor(fase-35): F4.<N> — split <entity> em queries/mutations/bulk/schemas/types (barrel neutro)`.

**Ordem:**
- F4.1 `custom-attributes` (483L) — ~20min.
- F4.2 `marketing-campaigns` (457L) + merge `marketing-campaigns-schemas.ts` — ~25min.
- F4.3 `opportunities` (467L) — ~20min.
- F4.4 `contacts` (486L) — ~20min.
- F4.5 `products` (599L) — ~25min.
- F4.6 `leads` (638L) — ~30min.
- F4.7 `activities` (920L) + merge `activities-schemas.ts` + `files.ts` (uploadFile/downloadFile) — ~50min.

**Smoke F4:** preservation-smoke após F4.7.

---

# FRENTE 3 — Decomposição monolitos (5 commits)

## Task F3.1..F3.5: Decompose

**Template (v3 fix #6 named export + v3 fix #7 gate context):**

1. **Setup** — `mkdir -p src/app/(protected)/<entity>/_components/<entity>`.
2. **Pre-check export** — `grep -E "export (default|const|function) \w*Content" <entity>-content.tsx` → confirmar named export `<Entity>Content` existe. Se só default: manter ambos (stub v3.14 faz re-export default também).
3. **Count callbacks** — contar handlers drilados entre sub-componentes no arquivo original. Se > 10 → `context.tsx` com `useReducer` + provider. Se ≤ 10 → props drilling OK (pular `context.tsx`).
4. **Split**:
   - `list-view.tsx` — table + motion + empty state.
   - `form-dialog.tsx` — Dialog Create/Edit + schema Zod (importar de `@/lib/actions/<entity>/schemas`).
   - `delete-confirm.tsx` — AlertDialog.
   - `use-<entity>-filters.ts` — filters + URL sync.
   - `types.ts` — entity-local types.
   - `context.tsx` (condicional) — useReducer + provider.
   - `index.tsx` — orchestrator CrmListShell + (provider se aplicável) + sub-arquivos.
5. **Stub re-export** — `<entity>-content.tsx` bridge:
   ```tsx
   // src/app/(protected)/<entity>/_components/<entity>-content.tsx
   // Bridge transitório (Fase 35) — consumer externos continuam importando este path.
   // Entrypoint canônico: ./<entity>/index.tsx.
   export { <Entity>Content } from "./<entity>";
   // Se consumer usa default import, descomentar:
   // export { default } from "./<entity>";
   ```
6. **Checks** — `npx tsc --noEmit && npm run build && npx vitest run <entity>`.
7. **Linha count** — `wc -l src/app/(protected)/<entity>/_components/<entity>/*.tsx` — nenhum > 400L.
8. **Preservation-smoke** local.
9. **Commit** — `refactor(fase-35): F3.<N> — decomposição <entity>-content em sub-arquivos <400L`.

**Ordem:**
- F3.1 `contacts` (869L) — ~20min.
- F3.2 `tasks` (997L) — ~20min.
- F3.3 `opportunities` (1056L) — ~20min.
- F3.4 `leads` (1057L) — ~20min.
- F3.5 `products` (1245L) — ~25min.

**Smoke F3:** preservation-smoke após F3.5.

---

# Pós-frentes

## Task Z.1: structural.test.ts (v3 fix #9)

Criar `src/__tests__/structural.test.ts`:

```ts
import { test, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";

const F3_TARGETS = [
  "src/app/(protected)/products/_components/products/index.tsx",
  "src/app/(protected)/leads/_components/leads/index.tsx",
  "src/app/(protected)/opportunities/_components/opportunities/index.tsx",
  "src/app/(protected)/tasks/_components/tasks/index.tsx",
  "src/app/(protected)/contacts/_components/contacts/index.tsx",
];

for (const f of F3_TARGETS) {
  test(`structural: ${f} ≤ 400L`, () => {
    if (!existsSync(f)) return;
    const lines = readFileSync(f, "utf8").split("\n").length;
    expect(lines).toBeLessThanOrEqual(400);
  });
}

test("structural: zero lib/<name>.ts + lib/<name>/ ambiguidade", () => {
  const entries = readdirSync("src/lib");
  const files = new Set(
    entries.filter((e) => e.endsWith(".ts")).map((e) => e.replace(".ts", "")),
  );
  const dirs = new Set(
    entries.filter((e) => statSync(`src/lib/${e}`).isDirectory()),
  );
  const ambiguous = [...files].filter((f) => dirs.has(f));
  expect(ambiguous).toEqual([]);
});

test("structural: zero *-schemas.ts soltos", () => {
  const stray = readdirSync("src/lib/actions").filter((e) =>
    e.endsWith("-schemas.ts"),
  );
  expect(stray).toEqual([]);
});

test("structural: barrel action index.ts não tem 'use server'", () => {
  const entities = readdirSync("src/lib/actions").filter((e) =>
    statSync(`src/lib/actions/${e}`).isDirectory() && !e.startsWith("__"),
  );
  for (const entity of entities) {
    const indexPath = `src/lib/actions/${entity}/index.ts`;
    if (!existsSync(indexPath)) continue;
    const content = readFileSync(indexPath, "utf8");
    expect(content).not.toMatch(/^\s*"use server"/m);
  }
});
```

- [ ] `npx vitest run structural` — todos verde pós-Fase 35.
- [ ] Commit `test(fase-35): structural.test.ts enforcement`.

## Task Z.2: ARCHITECTURE + MIGRATION + HANDOFF

- [ ] `docs/ARCHITECTURE.md` conforme plan v2 §Z.2.
- [ ] `docs/MIGRATION.md` conforme plan v2 §Z.2 + nota (v3 fix #14): "Canônico = `<entity>/index.tsx`; `<entity>-content.tsx` é bridge transitório (Fase 35); remover em fase futura quando consumers migrarem".
- [ ] `docs/HANDOFF.md` entrada Fase 35 Cleanup.
- [ ] Commit `docs(fase-35): ARCHITECTURE + MIGRATION + HANDOFF`.

## Task Z.3: Memory + graphify
- [ ] `convention_code_structure.md` (type: reference).
- [ ] `MEMORY.md` index atualizado.
- [ ] `graphify update .`.
- [ ] Commit `chore(graphify): pós Fase 35`.

## Task Z.4: Push + deploy
- [ ] `git push origin main`.
- [ ] CI Build+Push+Security verde.
- [ ] Portainer force update service.
- [ ] Smoke prod 16 rotas.
- [ ] Tag `fase-35-cleanup-deployed` + push.

---

## Rollback strategy

- **Atômico por sub-commit**: `git revert <sha>` — cada sub-commit é verde isolado.
- **Rollback de frente**: revert em ordem reversa dos sub-commits.
- **Rollback cross-frente** (raro): F4 revert quando F5 já em prod requer inverso `sed @/hooks → @/lib/hooks` + recreate `src/lib/hooks/` + `git revert F4.*`. Playbook: 15-30min.
- **Rollback prod pós-deploy**: `git revert <fase-35-cleanup-deployed-sha>` + push + Portainer redeploy.

---

## Resumo entregáveis (23 commits)

- [ ] F1.1, F1.2, F1.3 + smoke F1
- [ ] F2.1 + smoke F2
- [ ] F5.1, F5.2 + smoke F5
- [ ] F4.1..F4.7 + smoke F4 (F4.0 audit-only sem commit)
- [ ] F3.1..F3.5 + smoke F3
- [ ] Z.1 structural, Z.2 docs, Z.3 memory+graphify, Z.4 deploy

---

**Status:** plan v3 FINAL. Triplo-review completo. Pronto para execução via `superpowers:subagent-driven-development`.
