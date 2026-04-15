# Spec v2 — Fase 25: Busca Global UI (expansão)

**Status:** v2 (incorpora review #1 — sujeita a review #2)
**Data:** 2026-04-15
**Fase:** 25 — Busca Global UI
**Blueprint:** `nexus-blueprint/modules/search.md` consultado ✅
**Identidade visual:** mantém 100% o padrão existente (violet-600, Lucide icons, fonte Inter, design-system `@nexusai360/design-system`)

## 1. Contexto

Infra parcial já existente:

- **Backend:** `GET /api/search?q=...` + Server Action `search()` em `src/lib/actions/search.ts`, normalização NFD + tenant scoping multi-camada (admin/manager + super_admin exceção).
- **UI:** `CommandPalette` (cmdk + Dialog DS) — Ctrl/Cmd+K, debounce 300ms, grupos, keyboard nav ↑↓ + Enter + Esc, loading, empty state.
- **Gatilho:** botão `Search` no sidebar abre o palette; Ctrl+K global.
- **Provider:** `SearchProvider` em `src/app/(protected)/layout.tsx`.
- **RBAC:** `hasPermission(permission)` é async (busca sessão) em `src/lib/rbac/index.ts`. Deve ser chamado no servidor.

## 2. Gap identificado

1. **Deep-link ausente:** `href` genérico (lista) — deveria ir ao detalhe quando a rota existe.
2. **Sem scoring:** todos matches iguais; blueprint especifica `exact=100, startsWith=75, contains=50`.
3. **Sem highlight do match:** blueprint pede bold/highlight no substring.
4. **Sem recent searches:** repetição de queries sem memória.
5. **Entidades incompletas:** faltam products, tasks (activities), workflows, campaigns, segments.
6. **Sem tratamento de erro visível:** 500 da API silencia; user não sabe o que aconteceu.
7. **Acessibilidade:** falta `aria-live`/`aria-label` apropriados.

## 3. Escopo aprovado (v2)

### Incluído

- **Deep-link condicional por rota de detalhe existente:**
  - `/leads/{id}`, `/contacts/{id}`, `/opportunities/{id}` (rotas detalhe confirmadas em `src/app/(protected)/*/[id]/page.tsx`).
  - **Sem `?q=` fallback** em products/tasks/workflows/campaigns/segments até que Fase 26 (Filtros URL nestes módulos) conclua. Por ora: grupo entrega `href` de lista + documenta como follow-up.
- **Scoring server-side** (exact/startsWith/contains) + ordenação decrescente + tiebreaker alfabético.
- **Highlight do match** via componente `<HighlightMatch>` com token semântico:
  - `<mark class="bg-primary/15 text-foreground rounded-sm px-0.5 font-medium">` — cor primária via CSS var (suporte dark/light nativo).
  - Case- e diacritic-insensitive, múltiplas ocorrências destacadas.
- **Recent searches (localStorage) com TTL:** últimas 5 queries, TTL 30 dias, drop silencioso em modo privado (try/catch).
- **Expansão de entidades:** users, companies, leads, contacts, opportunities, **products, tasks, workflows, campaigns, segments**.
- **RBAC gating server-side:** `hasPermission()` antes de cada findMany; pula grupo quando false.
- **Erro de busca:** estado `error` exibe mensagem inline "Não foi possível buscar. Tente novamente." — sem toast (evita double-message; palette já está aberto e visível).
- **Acessibilidade:**
  - `aria-live="polite"` na região de resultados (anuncia "X resultados" quando muda).
  - `aria-label` nos grupos ("Leads — 3 resultados").
  - Input já tem focus automático (cmdk); garantir `aria-label="Busca global"`.
  - Kbd tags com `aria-hidden` (decorativas).
- **Mobile UX:** Dialog DS já é responsivo; confirmar `max-w-[calc(100%-2rem)]` funciona < 640px; touch target mínimo 44px nos itens.
- **Testes:** unit (scoring, highlight, recent), E2E admin.

### Fora de escopo (YAGNI)

- Saved searches (fase separada do roadmap).
- Fuzzy/trigram/pg_trgm.
- Filtros no palette ("type:query").
- Analytics/telemetry de buscas (follow-up).
- Server-side recent history.
- Deep-link `?q=` em products/tasks/... (depende de Fase 26).
- Rotas detalhe para products/companies/users (escopo separado).

## 4. Arquitetura

### 4.1. Backend

**Arquivos afetados:**
- `src/app/api/search/route.ts` (refatora response com scoring)
- `src/lib/actions/search.ts` (mesma lógica; Server Action alternativa se preferir)
- `src/lib/constants/search.ts` (novas entidades + labels)

**Tipos:**

```typescript
export interface SearchItem {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  type: SearchEntityType;
  score: 50 | 75 | 100;
}

export type SearchEntityType =
  | "user" | "company" | "lead" | "contact" | "opportunity"
  | "product" | "task" | "workflow" | "campaign" | "segment";

export interface SearchResponse {
  users?: SearchItem[];
  companies?: SearchItem[];
  leads?: SearchItem[];
  contacts?: SearchItem[];
  opportunities?: SearchItem[];
  products?: SearchItem[];
  tasks?: SearchItem[];
  workflows?: SearchItem[];
  campaigns?: SearchItem[];
  segments?: SearchItem[];
}
```

**Scoring (helper puro):**

```typescript
export function scoreMatch(value: string | null, normalizedQuery: string): 0 | 50 | 75 | 100 {
  if (!value) return 0;
  const v = normalize(value);
  if (v === normalizedQuery) return 100;
  if (v.startsWith(normalizedQuery)) return 75;
  if (v.includes(normalizedQuery)) return 50;
  return 0;
}
```

Para cada row: `score = Math.max(scoreMatch(title), scoreMatch(subtitle))`. Filtrar `score > 0`. Ordenar por `(-score, title)`. Take 5.

**Deep-link por tipo:**

```typescript
const HREF_BUILDER: Record<SearchEntityType, (item: any) => string> = {
  lead: (l) => `/leads/${l.id}`,
  contact: (c) => `/contacts/${c.id}`,
  opportunity: (o) => `/opportunities/${o.id}`,
  product: () => `/products`,       // TODO follow-up: /products/{id} quando existir
  task: (a) => a.subjectType && a.subjectId ? `/${pluralSubject(a.subjectType)}/${a.subjectId}` : `/tasks`,
  workflow: () => `/automation/workflows`,
  campaign: () => `/marketing/campaigns`,
  segment: () => `/marketing/segments`,
  user: () => `/users`,
  company: () => `/companies`,
};
```

**RBAC gating (servidor):**

```typescript
const [canViewLeads, canViewContacts, canViewOpps, canViewProducts, canViewTasks, canViewAutomation, canViewMarketing] = await Promise.all([
  hasPermission("leads:view"),
  hasPermission("contacts:view"),
  hasPermission("opportunities:view"),
  hasPermission("products:view"),
  hasPermission("activities:view"),
  hasPermission("automation:view"),
  hasPermission("marketing:view"),
]);
```

Cada findMany só dispara quando a flag correspondente é true.

**Novos grupos — mapeamento:**

| Grupo | Model | Fields | Title | Subtitle |
|---|---|---|---|---|
| `products` | `Product` | `name`, `sku` | `name` | `sku` |
| `tasks` | `Activity` (type ∈ task/call/meeting) | `title` | `title` | `type` |
| `workflows` | `Workflow` | `name` | `name` | `trigger` |
| `campaigns` | `Campaign` | `name` | `name` | `status` |
| `segments` | `Segment` | `name` | `name` | null |

Todos com `companyId: tenantFilter` quando não super_admin.

### 4.2. Frontend

**Arquivos afetados:**

- `src/components/layout/command-palette.tsx` — integração.
- `src/lib/search/recent.ts` — NOVO.
- `src/components/layout/highlight-match.tsx` — NOVO.
- `src/lib/constants/search.ts` — SEARCH_CONFIG atualizado.

**`recent.ts`:**

```typescript
const KEY = "nexus_crm_recent_searches_v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LIMIT = 5;

export interface RecentEntry { q: string; ts: number; }

export function getRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { queries: RecentEntry[]; version: 1; };
    const now = Date.now();
    return parsed.queries.filter((e) => now - e.ts < TTL_MS).slice(0, LIMIT);
  } catch { return []; }
}

export function addRecent(q: string) {
  if (!q || q.length < 2) return;
  try {
    const existing = getRecents().filter((e) => e.q !== q);
    const next = [{ q, ts: Date.now() }, ...existing].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify({ queries: next, version: 1 }));
  } catch {}
}

export function clearRecents() { try { localStorage.removeItem(KEY); } catch {} }
```

**`highlight-match.tsx`:**

```tsx
export function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const nText = normalize(text);
  const nQuery = normalize(query);
  const idx = nText.indexOf(nQuery);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/15 text-foreground rounded-sm px-0.5 font-medium">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
```

**CommandPalette — mudanças:**

1. Import `getRecents`, `addRecent`, `clearRecents`, `HighlightMatch`, novos ícones (`Package`, `CheckSquare`, `Workflow`, `Megaphone`, `Filter`, `Clock`, `X`).
2. `useState<RecentEntry[]>` para recents; `useEffect` carrega no mount.
3. Quando `query.trim().length < 2 && recents.length > 0` → renderiza "Buscas recentes" com items (ícone `Clock`) + botão "Limpar".
4. Ao selecionar um resultado: `addRecent(query)` antes de navegar.
5. Grupos iterados via ordem determinística: `["leads", "contacts", "opportunities", "products", "tasks", "workflows", "campaigns", "segments", "users", "companies"]`.
6. `aria-live="polite"` no `<Command.List>` container; `aria-label` em cada group.
7. Error state: catch no fetch → setState `error: true`; render "Não foi possível buscar. Tente novamente." em vez de resultados.

### 4.3. Constantes atualizadas

```typescript
// src/lib/constants/search.ts
export const SEARCH_CONFIG = {
  debounceMs: 300,
  minChars: 2,
  maxResults: 5,
  entities: ["leads","contacts","opportunities","products","tasks","workflows","campaigns","segments","users","companies"] as const,
} as const;

export const SEARCH_ENTITY_LABELS: Record<SearchEntity, string> = {
  leads: "Leads", contacts: "Contatos", opportunities: "Oportunidades",
  products: "Produtos", tasks: "Tarefas", workflows: "Automações",
  campaigns: "Campanhas", segments: "Segmentos",
  users: "Usuários", companies: "Empresas",
};
```

## 5. Identidade Visual (conformidade)

- `<mark>` com `bg-primary/15` (CSS var `--primary` → violet-600 light / 7c3aed dark).
- Ícones: `Package`, `CheckSquare`, `Workflow`, `Megaphone`, `Filter`, `Clock`, `X` (todos Lucide).
- Recent item: ícone `Clock` + texto + botão `×` à direita do grupo (não do item).
- Espaçamento/tamanho: mantém `px-4 py-3` por item (cmdk padrão atual).
- Fonte Inter herdada do root layout.
- Mobile: `max-w-[calc(100%-2rem)]` já no DialogContent; touch target ≥44px preservado.

## 6. Testes

### 6.1. Unit (vitest --environment=node / jsdom)

- `src/lib/search/scoring.test.ts` — `scoreMatch` (diacríticos, strings vazias, substrings).
- `src/lib/search/recent.test.ts` — add/get/clear, TTL, limite 5, SSR (window undefined) no-op, JSON corrompido → [].
- `src/lib/actions/search.test.ts` — RBAC gating (mock `hasPermission`), tenant scope, scoring ordering, group shape.
- `src/components/layout/highlight-match.test.tsx` — render com/sem match, múltiplas ocorrências (só primeira), diacríticos.

### 6.2. E2E (Playwright)

- `tests/e2e/specs/global-search.spec.ts`:
  - admin: abrir palette via Ctrl+K → digitar "ana" → ver grupos → Enter no primeiro lead → URL `/leads/{id}` → fechar (Esc) → reabrir → "ana" em recentes → click → auto-preenche.
  - viewer sem permissão (opcional): grupos restritos não aparecem.

## 7. Migrations

Nenhuma.

## 8. Performance

- 10 queries paralelas (vs 5 atual). P95 esperado < 150ms em dataset típico (< 10k rows por grupo).
- Índices existentes já cobrem `name`, `email`, `title` (Prisma default id índex + buscas com ILIKE). Adicionar `@@index` só se P95 degradar.
- Take 5 por grupo mantém payload pequeno (< 5 KB).

## 9. Riscos

- **hasPermission async 10× em paralelo:** cada chamada refaz lookup sessão. Mitigação: buscar user uma vez, shortcut `user.permissions.has(...)` — investigar impl atual; se custo alto, criar `hasPermissions(permissions[])` batched.
- **LocalStorage indisponível:** try/catch silencioso.
- **Activity sem companyId direto:** Activity em alguns specs vincula por `subject.companyId` indireto. Verificar model real; se não tem coluna, usar join via subject. Fallback: omitir tasks no MVP se complicado.
- **Next.js 16 strict mode + cmdk:** manter como está (já testado).

## 10. Critérios de sucesso

- [ ] Ctrl+K abre palette; busca "ana" ordena exact > startsWith > contains.
- [ ] Click em lead → `/leads/{id}` (não `/leads`).
- [ ] `<mark>` destaca match com cor primária (funciona dark e light).
- [ ] Query vazia + recents preenchidas → exibe "Buscas recentes" + clear button.
- [ ] Viewer sem `products:view` → grupo "Produtos" ausente.
- [ ] Erro servidor 500 → mensagem inline "Não foi possível buscar. Tente novamente.".
- [ ] `aria-live` anuncia contagem ao Screen Reader.
- [ ] E2E spec passa (≤ 8s local).
- [ ] `npm run build` clean; `npm run lint` clean; `npm audit --audit-level=low` exit 0.
