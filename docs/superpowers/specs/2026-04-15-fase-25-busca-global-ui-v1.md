# Spec v1 — Fase 25: Busca Global UI (expansão)

**Status:** v1 (primeiro esboço — sujeito a review #1)
**Data:** 2026-04-15
**Fase:** 25 — Busca Global UI
**Blueprint:** `nexus-blueprint/modules/search.md` consultado ✅
**Identidade visual:** mantém 100% o padrão existente (violet-600, Lucide icons, fonte Inter, design-system `@nexusai360/design-system`)

## 1. Contexto

O CRM já possui infraestrutura parcial de busca global:

- **Backend:** `GET /api/search?q=...` + Server Action `search()` em `src/lib/actions/search.ts`, com normalização NFD e tenant scoping (multi-camada admin/manager + super_admin).
- **UI:** `CommandPalette` (cmdk + Dialog DS) com Ctrl/Cmd+K, debounce 300ms, grupos por tipo, keyboard nav ↑↓ + Enter + Esc, loading, empty state.
- **Gatilho no header (sidebar):** botão `Search` visível abrindo o palette.
- **Provider:** `SearchProvider` em `src/app/(protected)/layout.tsx`.

## 2. Gap identificado (o que falta)

1. **Deep-link ausente:** `href` atual navega para lista (`/leads`, `/contacts`, `/opportunities`) — deveria ir ao detalhe (`/leads/{id}`, etc.) quando a rota de detalhe existe.
2. **Sem scoring:** todos matches tratados iguais; blueprint pede `exact=100, startsWith=75, contains=50` e ordenação.
3. **Sem highlight do match:** blueprint pede bold no substring que deu match no title/subtitle.
4. **Sem recent searches:** usuários repetem queries; guardar últimas N (localStorage) e exibir quando query vazia.
5. **Entidades incompletas:** busca cobre users/companies/leads/contacts/opportunities. Faltam entidades existentes no CRM: `products`, `activities` (tasks), `workflows`, `campaigns`, `segments`, `mailboxes`.
6. **Atalho "?" para help?** (rejeitado por YAGNI)

## 3. Escopo aprovado (v1)

### Incluído

- Deep-link para entidades com rota de detalhe (`/leads/{id}`, `/contacts/{id}`, `/opportunities/{id}`).
- Scoring no servidor com ordenação determinística.
- Highlight do match (bold + cor `text-foreground` no substring).
- Recent searches (localStorage, últimas 5, TTL 30 dias, limpar botão).
- Expandir entidades para: users, companies, leads, contacts, opportunities, **products, tasks, workflows, campaigns, segments**.
- Fallback para listas com `?q=` quando não há rota de detalhe (products/workflows/campaigns/segments/tasks usam query param para filtrar).
- RBAC: gating por permission — não mostra grupo se user não tem `<módulo>:view`.
- Testes: unit scoring + e2e spec admin busca global.

### Fora de escopo (YAGNI)

- Saved searches (isso vai para fase separada "Saved Filters" — já no roadmap).
- Fuzzy search / trigram / pg_trgm (overkill; ILIKE já resolve).
- Histórico server-side (localStorage basta).
- Voice search, AI suggestions.

## 4. Arquitetura

### 4.1. Backend

**Arquivo afetado:** `src/app/api/search/route.ts` + `src/lib/actions/search.ts`

Novos campos em cada item do response:

```typescript
interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;          // deep-link — /<módulo>/{id} quando houver rota detalhe
  type: string;          // "lead" | "contact" | "opportunity" | "product" | ...
  score: number;         // 100 | 75 | 50
  matchField: "title" | "subtitle";
}
```

**Scoring lógica (server):**

```typescript
function scoreMatch(value: string | null, normalized: string): number {
  if (!value) return 0;
  const v = normalizeString(value);
  if (v === normalized) return 100;
  if (v.startsWith(normalized)) return 75;
  if (v.includes(normalized)) return 50;
  return 0;
}
```

Para cada row encontrado: `Math.max(scoreMatch(title), scoreMatch(subtitle))`, filtro `>0`, ordenação decrescente, take 5 por grupo.

**Novos grupos:**

- `products` — `Product.name` + `Product.sku`, tenant-scoped por `companyId`, RBAC `products:view`, `href: /products?q={name}`.
- `tasks` — `Activity` onde `type ∈ {task, call, meeting}`, title, tenant-scoped, `href: /tasks?q={title}` ou `/{subjectType}/{subjectId}` (prioridade: subject se existir).
- `workflows` — `Workflow.name`, tenant-scoped, RBAC `automation:view`, `href: /automation/workflows`.
- `campaigns` — `Campaign.name`, tenant-scoped, RBAC `marketing:view`, `href: /marketing/campaigns`.
- `segments` — `Segment.name`, tenant-scoped, RBAC `marketing:view`, `href: /marketing/segments`.

### 4.2. Frontend

**Arquivos afetados:**

- `src/components/layout/command-palette.tsx` — integrar recent searches, highlight, deep-link, novos grupos.
- `src/lib/search/recent.ts` — NOVO, abstração localStorage (get/add/clear com TTL).
- `src/lib/search/highlight.tsx` — NOVO, helper `<HighlightMatch text={...} query={...} />`.
- `src/lib/constants/search.ts` — atualizar `SEARCH_CONFIG.entities` e labels.

**Recent searches:**

- Key: `nexus_crm_recent_searches_v1`.
- Shape: `{ queries: Array<{ q: string; ts: number; }>, version: 1 }`.
- TTL: 30 dias (drop ao ler).
- Limite: 5 mais recentes.
- UX: mostra quando `query.trim().length < 2` (substitui "Digite para buscar..." quando há recents). Click em recent preenche input.

**Highlight:**

- Componente puro `<HighlightMatch text={title} query={normalizedQuery} />` que quebra o texto em spans e envolve o match em `<mark className="bg-violet-500/20 text-foreground rounded px-0.5">`.
- Case-insensitive, acento-insensitive (reutiliza mesma `normalize`).

### 4.3. RBAC

Backend já respeita tenant scoping. Adicionar filtro por permission:

```typescript
const canSeeProducts = hasPermission(user, "products:view");
const canSeeMarketing = hasPermission(user, "marketing:view");
const canSeeAutomation = hasPermission(user, "automation:view");
// etc — pular grupos quando false, economiza queries.
```

## 5. Visual (identidade)

- Mantém Dialog DS, Command (cmdk), `violet-600` no kbd e no `<mark>`.
- Recent searches: seção com header "Buscas recentes" + ícone `Clock` (Lucide) + botão "Limpar" com ícone `X` à direita.
- Grupo de produtos: ícone `Package`. Tasks: `CheckSquare`. Workflows: `Workflow`. Campaigns: `Megaphone`. Segments: `Filter`.
- Footer existente preservado (↑↓ navegar, ↵ abrir).

## 6. Testes

### 6.1. Unit (vitest)

- `src/lib/search/recent.test.ts` — add, read, clear, TTL drop, limite 5.
- `src/lib/actions/search.test.ts` — scoring (exact/startsWith/contains), ordenação, RBAC gating.
- `src/lib/search/highlight.test.ts` — highlight simples, múltiplos matches, diacríticos.

### 6.2. E2E (Playwright)

- `tests/e2e/specs/global-search.spec.ts` — admin: abrir palette via Ctrl+K, buscar "ana" → ver resultados agrupados, Enter → navegar ao detalhe. Recent search aparece em abertura subsequente.

## 7. Migrations & dados

Nenhuma migration. Busca usa índices existentes; performance aceitável em volumes atuais (<10k rows por tabela típico tenant).

## 8. Riscos

- **Latência:** 10 queries paralelas (vs 5 hoje) — aceitável em PostgreSQL local, <100ms P95 esperado. Adicionar `take: 5` por grupo mantém constante.
- **LocalStorage não disponível (SSR/private mode):** try/catch + fallback no-op.
- **RBAC drift:** se `hasPermission` não for sync, reorganizar. Checar lib atual.
- **Conflito com /leads/[id]:** rotas já existem (confirmado).

## 9. Critérios de sucesso

- [ ] Ctrl+K abre palette; busca "ana" retorna grupos com scoring correto.
- [ ] Click em lead navega para `/leads/{id}` (não `/leads`).
- [ ] Match destacado visualmente.
- [ ] Query vazia mostra recents se houver; click preenche input.
- [ ] Viewer sem `products:view` não vê grupo Products.
- [ ] E2E spec admin passa.
- [ ] `npm run build` sem erros; `npm run lint` limpo.
- [ ] `npm audit` sem high/critical.
