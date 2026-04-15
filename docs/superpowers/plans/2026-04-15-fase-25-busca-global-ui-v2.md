# Plan v2 — Fase 25: Busca Global UI

**Status:** v2 (incorpora review #1)
**Spec:** `docs/superpowers/specs/2026-04-15-fase-25-busca-global-ui-v3.md`

## Ordem de execução

Dependências:

```
T1 normalize
 └─ T2 scoring
 └─ T3 recents
 └─ T4 HighlightMatch
T5 constants (independente)
T1..T5 → T6 API refactor
T6 → T7 actions/search.ts alinhamento
T1,T4,T5 → T8 CommandPalette integração
T2,T3,T4 → T9..T12 testes unit
T6,T8 → T13 E2E
T13 → T14 build/lint/audit
T14 → T15 docs/memory
T15 → T16 commit final + push
T16 → T17 monitor CI
T17 → T18 smoke prod + tag
```

---

## T1 — lib/search/normalize.ts

**Arquivo:** `src/lib/search/normalize.ts` (novo)

**Contrato:**

```typescript
export function normalize(str: string): string;
```

- Entrada: string arbitrária.
- Saída: `str.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()`.

**Aceite:**
- `normalize("Ação")` → `"acao"`.
- `normalize("  Maria  ")` → `"maria"`.

**Rollback:** remover arquivo.

---

## T2 — lib/search/scoring.ts

**Arquivo:** `src/lib/search/scoring.ts` (novo)

**Contrato:**

```typescript
export function scoreMatch(value: string | null | undefined, normalizedQuery: string): 0 | 50 | 75 | 100;
export function rankItems<T extends { title: string; subtitle: string | null }>(
  items: T[],
  normalizedQuery: string,
  limit?: number,
): Array<T & { score: 50 | 75 | 100 }>;
```

**Regras:**
- `scoreMatch`: exact=100, startsWith=75, contains=50, nenhum=0.
- `rankItems`: aplica scoreMatch em title e subtitle, pega max; filtra >0; ordena `(-score, title.localeCompare)`; slice limit (default 5).

**Aceite:** testes verdes (T9).
**Rollback:** remover arquivo.

---

## T3 — lib/search/recent.ts

**Arquivo:** `src/lib/search/recent.ts` (novo)

**Contrato:**

```typescript
export interface RecentEntry { q: string; ts: number; }
export function getRecents(): RecentEntry[];
export function addRecent(q: string): void;
export function clearRecents(): void;
```

**Regras:**
- Key: `nexus_crm_recent_searches_v1`.
- Shape stored: `{ version: 1, queries: RecentEntry[] }`.
- TTL: 30d = 30*24*60*60*1000.
- Limite: 5.
- `addRecent` dedupe por `q`, move para topo, slice 5.
- `getRecents` filtra TTL + slice 5.
- Todas as funções `try/catch` silencioso; SSR retorna `[]`/no-op quando `typeof window === "undefined"`.

**Aceite:** testes verdes (T10).
**Rollback:** remover arquivo.

---

## T4 — components/layout/highlight-match.tsx

**Arquivo:** `src/components/layout/highlight-match.tsx` (novo)

**Contrato:**

```typescript
export function HighlightMatch({ text, query }: { text: string; query: string; }): JSX.Element;
```

**Regras:**
- Se `!query || !text || query.length<2` → render `text` plain.
- Normaliza ambos; acha primeiro `indexOf`; usa índice para fatiar `text` original preservando case/acento.
- Envolve fatia em `<mark className="bg-primary/15 text-foreground rounded-sm px-0.5 font-medium">`.

**Aceite:** testes T11.
**Rollback:** remover arquivo.

---

## T5 — constants/search.ts

**Arquivo:** `src/lib/constants/search.ts` (edit)

**Mudança:**
- `entities` → `["leads","contacts","opportunities","products","tasks","workflows","campaigns","segments","users","companies"] as const`.
- Acrescentar em `SEARCH_ENTITY_LABELS` as labels novas.
- Adicionar export `SEARCH_ENTITY_ORDER` (mesmo array).
- Remover `SEARCH_ENTITY_ROUTES` se não usado (grep antes).

**Aceite:** type-check verde.
**Rollback:** git revert.

---

## T6 — api/search/route.ts (refactor)

**Arquivo:** `src/app/api/search/route.ts` (edit)

**Mudanças:**

1. Importar `normalize` de `@/lib/search/normalize`.
2. Importar `rankItems` de `@/lib/search/scoring`.
3. Importar `hasPermission` de `@/lib/rbac`.
4. Remover `normalize` local.
5. Adicionar função `hrefFor(type, item)` + `subjectPluralPath`.
6. Substituir `Promise.all` para incluir:
   - products (findMany `Product` where tenantFilter + OR name/sku)
   - tasks (findMany `Activity` where tenantFilter + type in [task, call, meeting] + title contains)
   - workflows (findMany `Workflow` where tenantFilter + name contains)
   - campaigns (findMany `Campaign` where tenantFilter + name contains)
   - segments (findMany `Segment` where tenantFilter + name contains)
   - Cada um gated por `hasPermission` batch.
7. Antes de mapear, aplicar `rankItems(rows.map(toSearchItem), normalized)` para cada grupo.
8. Response: omitir chaves vazias.

**Shape final de cada item:**

```json
{ "id": "…", "title": "…", "subtitle": "…" | null, "href": "/leads/<id>", "type": "lead", "score": 100 }
```

**Aceite:**
- `GET /api/search?q=ana` retorna 200 + grupos com score.
- Viewer sem `products:view` → sem chave `products`.
- `curl` local confirma deep-link.

**Rollback:** git revert arquivo.

---

## T7 — actions/search.ts alinhamento

**Arquivo:** `src/lib/actions/search.ts`

**Passo 1:** grep callers `search()` action. Se 0 callers:
- Remover arquivo.
- Atualizar index.
- Commit `chore(search): remove unused Server Action`.

Se há callers:
- Alinhar shape com API (scoring + novos grupos).

**Aceite:** `npm run build` + `grep` confirmando ausência.
**Rollback:** git revert.

---

## T8 — components/layout/command-palette.tsx integração

**Arquivo:** `src/components/layout/command-palette.tsx` (edit)

**Mudanças:**

1. Imports novos: `getRecents, addRecent, clearRecents, HighlightMatch, SEARCH_ENTITY_ORDER, SEARCH_ENTITY_LABELS`; ícones `Package, CheckSquare, Workflow as WorkflowIcon, Megaphone, Filter, Clock, X`.
2. `SearchItem` type: adicionar `score?: number`.
3. `SearchResponse` estendido com 5 novos grupos.
4. `ICON_MAP` estendido com 5 tipos novos.
5. Estado novo: `error: boolean`, `recents: RecentEntry[]`.
6. `useEffect` mount: `setRecents(getRecents())`.
7. `handleSelect(href)`: chamar `addRecent(query)` e `setRecents(getRecents())` antes de `router.push(href)`.
8. `search()` catch: `setError(true)` quando não-Abort.
9. Render:
   - Se `query.length<2 && recents.length>0` → bloco "Buscas recentes" com items (ícone Clock + entry.q) + botão clear.
   - Se `query.length<2 && recents.length===0` → placeholder atual.
   - Se `error && !loading` → "Não foi possível buscar. Tente novamente.".
   - Grupos iterados via `SEARCH_ENTITY_ORDER.filter(g => results?.[g]?.length)`.
   - `title` e `subtitle` renderizados via `<HighlightMatch text={} query={query} />`.
10. Acessibilidade:
    - `<Command.List>` wrapper: `<div role="status" aria-live="polite" aria-atomic="false">`.
    - Cada `Command.Group heading`: `aria-label="{label} — {count} resultado(s)"`.
    - kbd tags: `aria-hidden="true"`.
    - Input: `aria-label="Busca global"`.

**Aceite:** manual local + T13 E2E.
**Rollback:** git revert.

---

## T9 — Testes unit: normalize

**Arquivo:** `src/lib/search/normalize.test.ts` (novo, vitest)

Casos:
- "Ação" → "acao"
- "MARIA" → "maria"
- "  João  " → "joao"
- "" → ""
- "café-crème" → "cafe-creme"

**Aceite:** `npm test -- normalize` verde.

---

## T10 — Testes unit: scoring

**Arquivo:** `src/lib/search/scoring.test.ts` (novo)

Casos:
- `scoreMatch("Maria","maria") === 100`.
- `scoreMatch("Mariana","maria") === 75`.
- `scoreMatch("Ana Maria","maria") === 50`.
- `scoreMatch("Pedro","maria") === 0`.
- `scoreMatch(null,"x") === 0`.
- `rankItems` ordena exact > startsWith > contains.
- Tiebreak alfabético pt-BR para mesmos scores.
- Respeita limit (default 5).

---

## T11 — Testes unit: recents

**Arquivo:** `src/lib/search/recent.test.ts` (novo, vitest `environment: "jsdom"`)

Casos:
- `addRecent("maria")` então `getRecents().length === 1`.
- Duplicata não cresce array (dedupe + move topo).
- Mais de 5 → mantém 5.
- Entry com ts antigo (> 30d) é dropada ao get.
- `clearRecents()` esvazia.
- localStorage indisponível (mock lança) → funções não throwam.

---

## T12 — Testes unit: HighlightMatch

**Arquivo:** `src/components/layout/highlight-match.test.tsx` (novo, vitest jsdom + @testing-library/react)

Casos:
- Renderiza `<mark>` quando match existe.
- Sem match → plain text.
- Diacríticos: "João" + query "joao" → destaca "João" preservando case.
- Query curta (<2) → plain.

---

## T13 — E2E spec admin

**Arquivo:** `tests/e2e/specs/global-search.spec.ts` (novo)

Fluxo:
1. Load storageState admin.
2. Goto `/dashboard`.
3. Ctrl+K (`page.keyboard.press('Control+k')` ou Meta).
4. Digitar "lead" (via seed 2 leads).
5. Esperar grupo "Leads" visível.
6. `.first().click()` → url matches `/leads/[uuid]/`.
7. Voltar (`page.goBack()`), reabrir Ctrl+K, verificar recents.
8. Click em recent → input preenchido.

**Aceite:** `npm run test:e2e -- global-search` verde.
**Rollback:** remover arquivo.

---

## T14 — Build + lint + audit

```sh
npm run build
npm run lint
npm audit --audit-level=low --omit=dev
npx tsc --noEmit
```

Corrigir erros.

---

## T15 — Atualizar HANDOFF + memory

**Arquivos:**
- `docs/HANDOFF.md` — adicionar linha em §0 TL;DR + tabela §1.1 + commits §1.2.
- Memory novo `global_search_pattern.md`:
  ```
  scoring exact/startsWith/contains server-side + highlight + recents localStorage TTL 30d
  ```
- `memory/MEMORY.md` — adicionar link.

Commit: `docs(handoff+memory): Fase 25 — Busca Global deployed`.

---

## T16 — Commit + push final

1. `git status`, `git add -p` revisão.
2. Commits incrementais por passo anterior (agrupados se fizerem sentido).
3. `git push origin main`.

---

## T17 — Monitorar CI

- `gh run list --limit 3` até status success.
- Se falhar: puxar logs, fix forward, re-push.

---

## T18 — Smoke prod + tag

```sh
curl -s -o /dev/null -w "health:%{http_code} login:%{http_code}\n" \
  -X GET https://crm2.nexusai360.com/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://crm2.nexusai360.com/login
```

Ambos 200 → `git tag phase-25-global-search-deployed` + `git push --tags`.

---

## T19 — Verification before completion

Skill `superpowers:verification-before-completion`:
- Tests pass ✅
- Build clean ✅
- E2E verde ✅
- Smoke prod 200 ✅
- Tag aplicada ✅
- HANDOFF + memory atualizados ✅

Se algum não passa → não fechar fase.

---

## Rollback geral

`git revert <commit-range>` + `git push` + rollout automático Portainer → versão anterior restaurada.
