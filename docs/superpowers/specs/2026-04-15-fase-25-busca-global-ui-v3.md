# Spec v3 FINAL — Fase 25: Busca Global UI (expansão)

**Status:** v3 final — aprovada para planejamento
**Data:** 2026-04-15
**Fase:** 25 — Busca Global UI
**Blueprint:** `nexus-blueprint/modules/search.md` ✅
**Reviews:** #1 (cobertura + visual) + #2 (pente fino arquitetura) aplicados

---

## 1. Contexto

Infraestrutura parcial existente:

- **Backend:** `GET /api/search?q=...` + Server Action `search()` (`src/lib/actions/search.ts`), normalização NFD + tenant scoping multi-camada (admin/manager + super_admin).
- **UI:** `CommandPalette` (cmdk + Dialog DS), Ctrl/Cmd+K, debounce 300ms, grupos, keyboard nav, loading, empty state.
- **Gatilho:** botão `Search` no sidebar + Ctrl+K global.
- **Provider:** `SearchProvider` em `src/app/(protected)/layout.tsx`.
- **RBAC:** `hasPermission(permission): Promise<boolean>` em `src/lib/rbac/index.ts`.
- **Schemas validados:** `Product`, `Activity`, `Workflow`, `Campaign`, `Segment` todos com `companyId`. Permissions `products:view`, `activities:view`, `automation:view`, `marketing:view` já no `rbac/permissions.ts`.

## 2. Gap → Escopo

| Gap | Solução |
|---|---|
| Deep-link ausente | `/<módulo>/{id}` para leads/contacts/opportunities (rotas detalhe existem). Demais: link genérico + TODO follow-up. |
| Sem scoring | Server-side `exact=100 / startsWith=75 / contains=50`, ordenação `-score, title`. |
| Sem highlight | Componente `<HighlightMatch text query />` com `<mark class="bg-primary/15 …">`. |
| Sem recent searches | `localStorage` nexus_crm_recent_searches_v1, TTL 30d, limite 5, clear button. |
| Entidades incompletas | Adicionar products, tasks (Activity), workflows, campaigns, segments. |
| Sem tratamento de erro | Estado `error` inline: "Não foi possível buscar. Tente novamente.". |
| Acessibilidade | `aria-live="polite"` na lista; `aria-label` por grupo; kbd `aria-hidden`. |

### Fora de escopo (YAGNI)

- Saved searches (fase separada no roadmap).
- Fuzzy/trigram.
- Filtros "type:query" no palette.
- Analytics.
- Deep-link `?q=` em products/tasks/... (aguarda Fase 26).
- Rotas detalhe para products/companies/users.

## 3. Arquitetura

### 3.1. Novo helper compartilhado — `src/lib/search/normalize.ts`

```typescript
export function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
```

Reutilizado em: `api/search/route.ts`, `actions/search.ts`, `scoring.ts`, `highlight-match.tsx`.

### 3.2. Scoring — `src/lib/search/scoring.ts`

```typescript
import { normalize } from "./normalize";

export function scoreMatch(value: string | null | undefined, normalizedQuery: string): 0 | 50 | 75 | 100 {
  if (!value) return 0;
  const v = normalize(value);
  if (v === normalizedQuery) return 100;
  if (v.startsWith(normalizedQuery)) return 75;
  if (v.includes(normalizedQuery)) return 50;
  return 0;
}

export function rankItems<T extends { title: string; subtitle: string | null }>(
  items: T[],
  normalizedQuery: string,
  limit = 5,
): Array<T & { score: 50 | 75 | 100 }> {
  const scored = items
    .map((it) => ({ ...it, score: Math.max(scoreMatch(it.title, normalizedQuery), scoreMatch(it.subtitle, normalizedQuery)) as 0|50|75|100 }))
    .filter((it) => it.score > 0) as Array<T & { score: 50 | 75 | 100 }>;
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "pt-BR"));
  return scored.slice(0, limit);
}
```

### 3.3. API/Server Action — expansão

**Arquivo:** `src/app/api/search/route.ts` (canônico; deprecar ou alinhar `actions/search.ts` com mesmo shape).

```typescript
interface SearchItem {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  type: SearchEntityType;
  score: 50 | 75 | 100;
}
type SearchEntityType = "lead"|"contact"|"opportunity"|"product"|"task"|"workflow"|"campaign"|"segment"|"user"|"company";
type SearchResponse = Partial<Record<keyof typeof SEARCH_CONFIG.entities[number], SearchItem[]>>;
```

**Fluxo:**

1. `auth()` → session; sem sessão → 401.
2. `getCurrentUser()` → user; super_admin bypass tenant filter.
3. Batch `hasPermission` paralelo (leads/contacts/opportunities/products/activities/automation/marketing).
4. Tenant filter: `isSuperAdmin ? {} : { companyId: await requireActiveCompanyId() }` (catch → `__no_access__`).
5. `Promise.all` com condicionais:
   - leads if canViewLeads
   - contacts if canViewContacts
   - opportunities if canViewOpps
   - products if canViewProducts
   - tasks (Activity type ∈ {task,call,meeting}) if canViewActivities
   - workflows if canViewAutomation
   - campaigns if canViewMarketing
   - segments if canViewMarketing
   - users, companies: sem RBAC específico (como hoje)
6. Cada resultado passa por `rankItems` (ordenação por score + tiebreak alfabético pt-BR).
7. `hrefFor(type, item)` — builder.
8. Response: JSON com grupos presentes (omite chaves vazias).

**`hrefFor`:**

```typescript
function hrefFor(type: SearchEntityType, item: { id: string; subjectType?: string; subjectId?: string }): string {
  switch (type) {
    case "lead":        return `/leads/${item.id}`;
    case "contact":     return `/contacts/${item.id}`;
    case "opportunity": return `/opportunities/${item.id}`;
    case "product":     return `/products`;            // TODO Fase 26+: `/products?q=${name}`
    case "task":        return item.subjectId && item.subjectType
                          ? `/${subjectPluralPath(item.subjectType)}/${item.subjectId}`
                          : `/tasks`;
    case "workflow":    return `/automation/workflows`;
    case "campaign":    return `/marketing/campaigns`;
    case "segment":     return `/marketing/segments`;
    case "user":        return `/users`;
    case "company":     return `/companies`;
  }
}
function subjectPluralPath(subjectType: string): string {
  const map: Record<string,string> = { lead: "leads", contact: "contacts", opportunity: "opportunities" };
  return map[subjectType.toLowerCase()] ?? "tasks";
}
```

### 3.4. Frontend — arquivos

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `src/lib/search/normalize.ts` | novo | helper compartilhado |
| `src/lib/search/scoring.ts` | novo | scoreMatch + rankItems |
| `src/lib/search/recent.ts` | novo | localStorage recents (get/add/clear + TTL 30d) |
| `src/components/layout/highlight-match.tsx` | novo | componente puro `<HighlightMatch>` |
| `src/components/layout/command-palette.tsx` | edit | integrar recents, highlight, novos grupos, error state, a11y |
| `src/lib/constants/search.ts` | edit | expandir entities + labels + iconMap |
| `src/app/api/search/route.ts` | edit | scoring + novas entidades + deep-link |
| `src/lib/actions/search.ts` | edit | alinhar shape (ou deprecar se não usado) |

### 3.5. `CommandPalette` — diffs-chave

- Estado novo: `error: boolean`, `recents: RecentEntry[]`.
- Mount: `setRecents(getRecents())`.
- Select: `addRecent(query); setRecents(getRecents()); closeSearch(); ...`.
- Empty query path: se `recents.length > 0` → mostra "Buscas recentes" + 5 items (`Clock` ícone) + botão "Limpar" à direita do heading. Senão placeholder atual "Digite para buscar…".
- Render item: `<p>{<HighlightMatch text={item.title} query={query} />}</p>` idem subtitle.
- Error render: substitui lista quando `error && !loading`.
- `aria-live="polite"` no container externo da lista; cada `Command.Group` com `aria-label={LABEL[group] + " — " + count + " resultados"}`.

### 3.6. Constantes

```typescript
// src/lib/constants/search.ts
export const SEARCH_CONFIG = {
  debounceMs: 300,
  minChars: 2,
  maxResults: 5,
  entities: ["leads","contacts","opportunities","products","tasks","workflows","campaigns","segments","users","companies"] as const,
} as const;

export const SEARCH_ENTITY_LABELS = {
  leads: "Leads", contacts: "Contatos", opportunities: "Oportunidades",
  products: "Produtos", tasks: "Tarefas",
  workflows: "Automações", campaigns: "Campanhas", segments: "Segmentos",
  users: "Usuários", companies: "Empresas",
} as const;

export const SEARCH_ENTITY_ORDER = [
  "leads","contacts","opportunities","products","tasks",
  "workflows","campaigns","segments","users","companies",
] as const;
```

## 4. Identidade Visual

- `<mark>` com `bg-primary/15` (CSS var `--primary` = violet-600 / 7c3aed).
- Ícones Lucide: `Clock` (recents), `X` (clear), `Package` (products), `CheckSquare` (tasks), `Workflow`, `Megaphone` (campaigns), `Filter` (segments), mantidos `Target`/`Contact`/`TrendingUp`/`Building2`/`Users`.
- Touch target mínimo 44px preservado.
- Fonte Inter herdada.

## 5. Testes

### 5.1. Unit (vitest)

- `src/lib/search/scoring.test.ts` — exact/startsWith/contains/diacritic/sort + tiebreak.
- `src/lib/search/recent.test.ts` — add (dedupe), get (filtro TTL), clear, SSR no-op, JSON corrompido.
- `src/lib/search/normalize.test.ts` — diacríticos, emojis, case.
- `src/components/layout/highlight-match.test.tsx` — match simples, sem match, case/diacritic, múltiplas ocorrências (apenas primeira destaca).
- `src/lib/actions/search.test.ts` — RBAC gating, tenant filter, payload shape.

### 5.2. E2E (Playwright)

- `tests/e2e/specs/global-search.spec.ts` — admin: Ctrl+K → "ana" → grupos → Enter → `/leads/{uuid}` → close → reopen → recents → click → input preenche.

## 6. Documentação & Memória

- **Docs:**
  - `docs/superpowers/specs/2026-04-15-fase-25-busca-global-ui-v1.md` (histórico)
  - `docs/superpowers/specs/2026-04-15-fase-25-busca-global-ui-v2.md` (histórico)
  - `docs/superpowers/specs/2026-04-15-fase-25-busca-global-ui-v3.md` (FINAL)
- **Memory:** novo `global_search_pattern.md` com scoring + recents + RBAC gating.
- **HANDOFF.md:** atualizar com Fase 25 ✅ + tag.
- **Blueprint (opcional):** se o usuário aceitar, PR no `nexus-blueprint/modules/search.md` atualizando spec com scoring + recents + RBAC.

## 7. Commits esperados (preview)

1. `feat(search): helpers normalize + scoring + ranking`
2. `feat(search): lib recents com TTL + HighlightMatch component`
3. `feat(search): expansão entidades (products/tasks/workflows/campaigns/segments)`
4. `feat(search): deep-link leads/contacts/opportunities + RBAC gating`
5. `feat(search): integrar recents, highlight, erro e a11y no CommandPalette`
6. `test(search): unit scoring/recents/normalize/highlight + E2E admin`
7. `docs(handoff+memory): Fase 25 — Busca Global UI deployed`

## 8. Critérios de sucesso

- [ ] Ctrl+K abre palette; "ana" retorna grupos ordenados por score.
- [ ] Click em lead → `/leads/{id}`.
- [ ] `<mark>` destaca match em light e dark.
- [ ] Recents aparecem ao abrir; click preenche input; "Limpar" zera.
- [ ] Viewer sem permission não vê grupo correspondente.
- [ ] Erro 500 → mensagem inline amigável.
- [ ] `aria-live` funciona com screen reader.
- [ ] E2E spec verde (≤10s local).
- [ ] `npm run build`, `npm run lint`, `npm audit --audit-level=low` limpos.
- [ ] Monitoring pós-deploy: `/api/health` 200, `/login` 200, sem regressão em outras rotas.

## 9. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| 10 paralelos + 7 hasPermission sobrecarrega request | Batch Promise.all; user.permissions se impl sync disponível |
| localStorage indisponível (SSR/private) | try/catch silencioso, UX sem recents |
| Ordem de `Command.Item value` colide entre grupos | value = `${type}:${id}` única |
| Cmdk deriva scroll inesperado com muitos grupos | Manter `max-h-[480px] overflow-y-auto`, testar P95 com 50 items |
| Next 16 CSR hydration warning com `<mark>` | Componente client; sem mismatch |

## 10. Entregáveis

1. 8 arquivos novos/editados (ver §3.4).
2. 5 suites de testes unit + 1 E2E.
3. Spec v1, v2, v3 comitados.
4. Plan v1, v2, v3 comitados (próxima etapa).
5. Memory + HANDOFF atualizados.
6. Tag `phase-25-global-search-deployed`.
