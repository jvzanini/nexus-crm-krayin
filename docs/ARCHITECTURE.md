# Arquitetura — Nexus CRM Krayin

## Convenções de pastas

- `src/app/` — Next.js App Router (route groups `(protected)` + `(auth)`).
- `src/components/` — componentes de UI organizados por feature (`activity/`, `custom-attributes/`, `dashboard/`, `layout/`, `login/`, `providers/`, `tables/`, `ui/`, etc.).
- `src/lib/<domain>/` — lógica de negócio por domínio. **Sem arquivo solto `src/lib/<name>.ts` quando existe pasta homônima** (resolve ambiguidade de resolução).
- `src/hooks/` — custom hooks reutilizáveis (Next 15+ convention; migrado de `src/lib/hooks/` na Fase 35).
- `src/lib/actions/` — Server Actions por entidade.
- `src/generated/prisma/` — gerado automaticamente pelo Prisma; **nunca editar à mão**.

## Route groups

- `(protected)` — rotas autenticadas (dashboard, leads, contacts, opportunities, etc.).
- `(auth)` — login, verify-email, forgot-password, reset-password.
- Evitar route groups ad hoc adicionais.

## Convenção `src/lib/<domain>/`

Cada domínio é uma pasta com `index.ts` barrel:

```
src/lib/audit-log/
├── index.ts          ← re-exporta surface pública
├── wrapper.ts        ← lógica de negócio
├── persist.ts
└── events/
```

O barrel (`index.ts`) centraliza o que é consumível via `import from "@/lib/<domain>"`.

## Server Actions (Fase 35 F4 — convenção futura)

Cada entidade vira pasta `src/lib/actions/<entity>/`:

```
src/lib/actions/<entity>/
├── index.ts          ← barrel NEUTRO (sem "use server"); re-exporta funcs + types + schemas
├── queries.ts        ← "use server" — listX, getX, searchX
├── mutations.ts      ← "use server" — createX, updateX, deleteX
├── bulk.ts           ← "use server" — updateXBulk, deleteXBulk, assignXBulk
├── schemas.ts        ← Zod schemas (sem diretiva; importado por queries/mutations/bulk)
├── types.ts          ← TS types (importa schemas via z.infer; inverso proibido)
└── __tests__/
```

**Barrel pattern (v3 Fase 35):**

```ts
// src/lib/actions/<entity>/index.ts
// Barrel NEUTRO — sem "use server". Re-exporta funcs + types + schemas.
export * from "./queries";
export * from "./mutations";
export * from "./bulk";
export * from "./schemas";
export * from "./types";
```

**Regras:**
- `queries.ts` / `mutations.ts` / `bulk.ts` começam com `"use server"`.
- `schemas.ts` e `types.ts` **não** têm diretiva (`"use server"` proíbe re-export de types em Next 16 + Turbopack).
- `index.ts` barrel **não** declara `"use server"`.
  Em Next 16, um barrel `"use server"` re-exportando módulos `"use server"` gera double-boundary com action IDs duplicados (risco runtime). Barrel neutro preserva identidade da action via arquivo fonte.
- Direção: `types.ts` importa de `schemas.ts` via `z.infer<>`. Inverso proibido.

**Public surface:**
- `@/lib/actions/<entity>` → resolve `index.ts` neutro; consumer importa funcs + types + schemas pelo mesmo path.
- Paths específicos (opcional): `.../queries`, `.../mutations`, `.../bulk`, `.../schemas`, `.../types`.

## Server Action args contract

- Args = `FormData` ou JSON-serializable primitives (string, number, boolean, object, array).
- Closures via `.bind(null, primitives)` apenas. Nunca bind de `Date`, `RefObject`, funções, classes.
- Server Actions não retêm closures client-side — apenas args passados explicitamente.

## Testes

- Co-localizados em `__tests__/` dentro do módulo pai.
- Exemplo: `src/lib/rbac/__tests__/rbac.test.ts`.
- Glob vitest: `src/**/*.test.{ts,tsx}` (cobre `__tests__/` e `.test.ts` soltos, mas o padrão é `__tests__/`).
- Imports relativos do teste: `../X` (sobe 1 nível do `__tests__/` para o módulo pai).
- Evitar `*.test.ts` soltos ao lado do código; migrar para `__tests__/` do próprio módulo.

## Hooks

- `src/hooks/` — hooks globais reutilizáveis (`use-debounced-value`, `use-saved-filters`, etc.).
- Hooks específicos de domínio em `src/lib/<domain>/hooks/` ou `_components/<route>/use-<entity>-*.ts`.

## Lint structural

`src/__tests__/structural.test.ts` enforca:
1. Zero arquivos > 400L nas 5 entidades F3 decompostas.
2. Zero ambiguidade `lib/<name>.ts` + `lib/<name>/`.
3. Zero `*-schemas.ts` soltos em `src/lib/actions/`.
4. Zero `"use server"` em barrel `index.ts` de actions.

## Fases de cleanup (histórico)

- **Fase 35 F1** (2026-04-17): resolvida ambiguidade `lib/audit-log.ts|email.ts|flags.ts` + pasta homônima. Arquivos soltos movidos para `<pasta>/wrapper.ts` ou `resend-transport.ts` + re-export via `index.ts` barrel.
- **Fase 35 F2** (2026-04-17): route group legacy `(app)/settings/data-transfer/actions.ts` movido para `(protected)/`.
- **Fase 35 F5** (2026-04-17): `src/lib/hooks/` → `src/hooks/`; 39 tests soltos normalizados em `__tests__/` por módulo.
- **Fase 35 F4** (pendente): partição de 7 server-action files gigantes (`activities` 920L, `leads` 638L, etc.) em `<entity>/{queries,mutations,bulk,schemas,types}.ts` com barrel neutro. Ver spec `docs/superpowers/specs/2026-04-17-organizacao-consistencia-v3.md`.
- **Fase 35 F3** (pendente): decomposição de 5 monolitos `_components/*-content.tsx` (500-1245L) em sub-arquivos <400L com context/useReducer + stub re-export para preservar imports.
