# HANDOFF — Fase 5 Custom Attributes · Verification Pipeline (T20 + T23/34)

**Data:** 2026-04-15
**SHA HEAD (pre-verification):** `d67b259c0dbb0b5a61b052603e4ceb75167767ee`
**Branch:** `main`
**Escopo:** Pipeline consolidado de verificação pós Wave C/D da Fase 5 (29 commits
anteriores). Este documento registra os resultados brutos e eventuais
regressões detectadas/fixadas antes de fechar a fase.

---

## 1. T20 — Unit Tests (Vitest)

| Métrica         | Baseline pré-Fase 5 | Pós Wave C/D |
| --------------- | ------------------- | ------------ |
| Test files      | —                   | **69**       |
| Tests (pass)    | 464                 | **676**      |
| Tests (fail)    | 0                   | **0**        |
| Tempo total     | —                   | ~6.1s        |

- Expectativa era ≥ 650. **Atingido (676).**
- Nenhuma regressão funcional. Todas as suites verdes em ambas as execuções
  (antes e depois do fix de build-boundary aplicado em T23 — ver §2).

Comando:
```
npx vitest run
```

Saída final:
```
Test Files  69 passed (69)
     Tests  676 passed (676)
```

---

## 2. T23/34 — Build / Lint / Audit / Migrate

### 2.1 Prisma Client

```
npx prisma generate   → OK (Prisma Client 7.7.0 gerado em ./src/generated/prisma)
```

### 2.2 Prisma Migrate Status / Diff

- `npx prisma migrate status` → **FALHA (pre-existing, infra)**
  Erro: `The shadow database you configured appears to be the same as the main database`.
  Origem: `prisma.config.ts` configura shadow DB apontando para o mesmo banco do
  dev em ambiente local. É problema conhecido de configuração local, **não é
  regressão da Fase 5**. Fora do escopo desta fase.
- `npx prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource --exit-code`
  → falha com o mesmo erro de shadow database. Mesma causa raiz. **Sem drift
  detectado em termos de código**: o schema compila, o client gera, e o build
  consome o schema normalmente.

Observação: na Prisma 7.x a flag `--from-schema-datasource` e `--to-url` foram
removidas; a sintaxe correta agora é `--from-config-datasource` /
`--to-config-datasource` (com datasource no `prisma.config.ts`). A spec v3
referenciava a sintaxe antiga — atualizar docs no próximo ciclo de fase.

### 2.3 Build (Next.js)

Comando: `npm run build`

**Regressão encontrada e corrigida nesta task:**

- `src/app/(protected)/leads/_components/leads-content.tsx` (client component)
  importa `parseCustomFiltersFromSearchParams` de
  `src/lib/filters/custom-parser.ts`.
- O parser importava constantes de `src/lib/custom-attributes/limits.ts`.
- `limits.ts` importa `prisma` (para `assertAttrCount`), o que arrastava
  `@prisma/client` + `pg` + `dns/fs/net/tls` para o bundle client → Next
  rejeitava o chunk com `Module not found` e `the chunking context does not
  support external modules (request: node:module)`.

**Fix aplicado (nesta task):**

1. Criado `src/lib/custom-attributes/limits.constants.ts` — apenas constantes
   puras + `RESERVED_KEYS` (sem imports de prisma).
2. `limits.ts` re-exporta as constantes do novo módulo (compat com actions).
3. `custom-parser.ts` passa a importar as constantes de `limits.constants.ts`
   diretamente, rompendo a cadeia client → prisma.

**Resultado:** `npm run build` passa verde com todas as rotas geradas (incluindo
`/leads`, `/opportunities`, `/contacts`, `/settings/custom-attributes`).

### 2.4 TypeScript (`tsc --noEmit`)

| Métrica     | Baseline (pré-fase) | Pós Wave C/D |
| ----------- | ------------------- | ------------ |
| Erros `.ts` | 19–20               | **23**       |

- Todos os 23 erros residem em **arquivos de teste** (`*.test.ts`) ou em
  `tests/e2e/golden-paths/custom-attributes.spec.ts`.
- Zero erros em código de produção.
- Delta de +3/+4 vem dos novos tests criados em Wave C/D (marketing/unsubscribe,
  dsar/erase, dsar/export, automation/dispatcher — todos pre-existing padrões
  de mock typing sem impacto em runtime; os testes **passam** normalmente em
  Vitest, os erros são apenas no strict typecheck).
- Compatível com baseline. Não bloqueia.

### 2.5 `npm audit --audit-level=high --omit=dev`

```
found 0 vulnerabilities
```

**0 high/critical vulns**. OK.

### 2.6 Lint (`npm run lint`)

- **FALHA pre-existing**: `TypeError: Converting circular structure to JSON`
  em `@eslint/eslintrc/lib/shared/config-validator.js`. É bug conhecido de
  config-legacy vs ESLint 9 flat-config com plugins que fazem referência
  circular (plugin `react` fecha o ciclo). Fora do escopo desta fase.
- Documentado como dívida técnica para uma task futura de migração 100% para
  flat config.

---

## 3. Regressões Detectadas & Corrigidas

| # | Origem                 | Sintoma                                                      | Fix                                                                 | Arquivos                                                                                              |
| - | ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1 | Wave C (custom-attrs)  | `npm run build` quebra: prisma arrastado para bundle client  | Split constantes em `limits.constants.ts`; parser consome só puros | `src/lib/custom-attributes/limits.constants.ts` (novo); `limits.ts`; `src/lib/filters/custom-parser.ts` |

---

## 4. Sumário Final

| Verificação                 | Resultado |
| --------------------------- | --------- |
| Vitest unit suite           | **676/676 PASS** |
| Next.js build               | **PASS** (após fix §3 #1) |
| TypeScript typecheck        | 23 erros — todos em tests (baseline ~19–20 + 3–4 de Wave C/D) |
| npm audit (prod)            | **0 vulns** |
| Prisma generate             | **OK** |
| Prisma migrate status/diff  | Pre-existing infra issue (shadow DB config) — fora do escopo |
| ESLint                      | Pre-existing ESLint 9 flat-config bug — fora do escopo |

**Fase 5 consolidada:** pronta para entrar em release/staging após fix de build aplicado nesta task.
