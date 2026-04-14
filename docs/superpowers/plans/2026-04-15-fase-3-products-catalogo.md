# Plan: Fase 3 — Products & Catálogo (multi-moeda)

**Data:** 2026-04-15
**Versão:** v3 (inline 2 reviews)
**Spec:** `docs/superpowers/specs/2026-04-15-fase-3-products-catalogo-design.md`

---

## Changelog

### v2 → v3 (Review 2 profunda)
- Permissions `products:*` entram em `src/lib/rbac/permissions.ts` ANTES da migration — senão server action testa contra uma permission que a matriz não conhece.
- Seed é T separada (T6) e roda **depois** da migration — não assume ordem implícita.
- Decimal arithmetic: teste boundary com número grande + confirma `Prisma.Decimal.toNumber()` mantém precisão em valores razoáveis (<=1e10); se maior, usar `.toString()` no transporte.

### v1 → v2 (Review 1 ampla)
- T1 (migration) separada de T2 (allowlist) — uma vai pro DB, outra é TS puro.
- UI (T5) dividida em página (list) + form (create/edit) para reduzir escopo de PR.

---

## Tasks

**T1. Migration `products` + `product_prices` + `Company.defaultCurrency`**
- schema.prisma + `prisma/migrations/20260417000000_products/migration.sql` (+ down.sql).
- **Aceite:** `prisma validate` ok; SQL aplicável.

**T2. `src/lib/currency/allowlist.ts`**
- `SUPPORTED_CURRENCIES`, `isSupportedCurrency`, `currencyLabel`.
- Unit test: allowlist ≥ 10; unknown rejeitado.
- **Aceite:** `vitest run src/lib/currency` verde.

**T3. RBAC: adicionar `products:*` em permissions.ts**
- Update `PERMISSIONS` + `ROLE_PERMISSIONS`.
- Atualizar test rbac para cobrir nova permission em cada role.
- **Aceite:** `vitest run src/lib/rbac` verde.

**T4. Server actions `src/lib/actions/products.ts`**
- list/get/create/update/archive/unarchive/delete/upsertPrice/deletePrice.
- Todas com `requirePermission` e tenant-scope por `companyId`.
- Zod schemas: sku normalizado (trim+upper), currency via `isSupportedCurrency`, amount >=0 decimal.
- Unit tests: schema validation + duplicate SKU returning user-friendly error.
- **Aceite:** `vitest run` verde.

**T5. UI `/products`**
- Server Component page → Client component `ProductsContent`.
- Pattern DS: Card wrapper, Table, Dialog (create/edit), AlertDialog (archive/delete).
- Rule `no-ad-hoc-role-check` continua verde (usar `userHasPermission`).
- **subagent_safe:** yes.
- **Aceite:** build Next OK (CI); E2E quando CI rodar.

**T6. i18n products pack + seed**
- `src/locale/packs/{br,us}/messages/products.json`.
- Atualizar `src/lib/locale/messages.ts` para carregar pack.
- `prisma/seed.ts` adiciona 6 produtos × 2 categorias por company.
- **Aceite:** `scripts/check-i18n-parity.ts` passa (parity entre br e us).

**T7. Memory + roadmap + tag**
- `product_catalog_pattern.md`, `currency_policy.md`.
- Roadmap Appendix A: linhas parity.
- Tag `phase-3-deployed`.

## Ordem

1. T3 (rbac) — bloqueia T4.
2. T1 (migration) + T2 (allowlist) em paralelo.
3. T4 (actions) após T1+T2+T3.
4. T5 (UI) + T6 (i18n+seed) em paralelo após T4.
5. T7 fechamento.
