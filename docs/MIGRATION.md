# Migration Guide — Fase 35 Cleanup

## F1: `lib/<name>.ts` + `lib/<name>/` resolved (2026-04-17)

Sem impacto nos consumers. Os 3 pares ambíguos resolvidos:

| Antes | Depois | Consumers |
|---|---|---|
| `src/lib/audit-log.ts` (44L, wrapper async) | `src/lib/audit-log/wrapper.ts` + `audit-log/index.ts` barrel | 9 (inalterados) |
| `src/lib/email.ts` (68L, Resend transport) | `src/lib/email/resend-transport.ts` + `email/index.ts` barrel | 2 (inalterados) |
| `src/lib/flags.ts` (2L stub) | Constantes `DS_V3_ENABLED`, `DS_PREVIEW` movidas para `src/lib/flags/index.ts` | 1 (inalterado) |

Paths `@/lib/audit-log`, `@/lib/email`, `@/lib/flags` continuam válidos (resolvem o `index.ts` da pasta).

## F2: `(app)/settings/data-transfer` → `(protected)/settings/data-transfer`

- URL `/settings/data-transfer` mantida.
- Route group `(app)` eliminado.
- Arquivo migrado: `actions.ts` (Server Actions da rota).

## F5: Hooks + tests padronizados

**F5.1 — Hooks:**
- `src/lib/hooks/*` → `src/hooks/*`.
- Consumer: `@/lib/hooks/X` → `@/hooks/X` (find-replace automatizado em 10 arquivos).

**F5.2 — Tests (Grupo B, 39 arquivos):**
- `src/lib/<domain>/*.test.ts` → `src/lib/<domain>/__tests__/*.test.ts`.
- Paths relativos internos ajustados (`./X` → `../X`; `../X` → `../../X` em alguns casos, revertido quando over-corrigiu).

**F5.2 Grupo A (pendente em F4):** 14 testes em `src/lib/actions/*.test.ts` ficam no local original até F4 partitioning.

## F4: Server Actions partition (pendente)

Quando executado, cada entidade vira pasta com:
```
src/lib/actions/<entity>/
├── index.ts          ← barrel NEUTRO
├── queries.ts        ← "use server"
├── mutations.ts      ← "use server"
├── bulk.ts           ← "use server"
├── schemas.ts
├── types.ts
└── __tests__/
```

**Public surface 100% preservada** via barrel neutro. Zero migration de consumers.

Paths opcionais (mais explícitos):
- `@/lib/actions/<entity>/queries|mutations|bulk` → só funcs.
- `@/lib/actions/<entity>/schemas` → só Zod schemas.
- `@/lib/actions/<entity>/types` → só TS types.

Aplicar em: `activities`, `leads`, `products`, `contacts`, `custom-attributes`, `opportunities`, `marketing-campaigns`.

## F3: Decomposição de monolitos (pendente)

5 monolitos `_components/*-content.tsx` decompostos em:
```
_components/<entity>/
├── index.tsx              ← orchestrator
├── list-view.tsx
├── form-dialog.tsx
├── delete-confirm.tsx
├── use-<entity>-filters.ts
├── context.tsx            ← (condicional, callbacks > 10)
└── types.ts
```

`<entity>-content.tsx` legado vira **stub re-export** para preservar imports externos:

```tsx
// Bridge transitório (Fase 35) — entrypoint canônico: ./<entity>/index.tsx
export { <Entity>Content } from "./<entity>";
```

Consumers de `./_components/<entity>-content` continuam válidos.

## Linter structural (em progresso)

`src/__tests__/structural.test.ts` enforça regras F1-F5. Pendente criar pós-F4/F3.
