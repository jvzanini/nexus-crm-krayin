# Spec: Fase 3 — Products & Catálogo (multi-moeda)

**Data:** 2026-04-15
**Versão:** v3 (final — após Review 1 ampla e Review 2 profunda, inline)
**Depende de:** Fase 1b (telas migradas para DS), Fase 1c (RBAC granular).
**Gate para:** Fase 4 (Quotes).

---

## Changelog

### v2 → v3 (Review 2 profunda)
- **Moeda base do tenant:** adicionado campo `Company.baseCurrency` (ISO-4217, default "BRL"). Antes era campo livre; agora restringido à allowlist.
- **Allowlist de currencies:** `src/lib/currency/allowlist.ts` com 10 moedas iniciais (BRL, USD, EUR, GBP, ARS, CLP, MXN, CAD, AUD, JPY). Adição futura via migration de dados, não env.
- **Índice composto:** `Product.sku` único por company (não global). Mudança crítica — impossibilita colisão cross-tenant e permite SKU "P-001" em múltiplos tenants.
- **Preço `0`:** permitido (produto gratuito/gift); validado `>= 0`. Negativo rejeitado.
- **Arquivamento (soft-delete):** `active: boolean` + `archivedAt: DateTime?`. Delete físico bloqueado quando produto referenciado em Quote futura (Fase 4 FK Restrict). Em 1b1c não há referência, então delete é permitido.
- **Busca:** simples `where.contains` em name/sku; full-text search fica para Fase 10 (search global).
- **Category:** string livre (não entidade). Se surgir demanda em Fase 4, promove para Category model.

### v1 → v2 (Review 1 ampla)
- Multi-currency modelado como child `ProductPrice[]` (1-N) em vez de JSONB no Product. Motivo: queries de filtro/sort por preço precisam de index; JSONB dificulta.
- RBAC `products:view|create|edit|delete|manage` adicionado à matriz (Fase 1c).
- Seed demo com 6 produtos (2 categorias) em cada company do seed.

---

## 1. Objetivo

1. Catálogo de produtos por tenant com **SKU único**, nome, descrição, categoria (string), ativo/arquivado.
2. **Multi-currency:** cada produto tem N rows em `product_prices` (currency ISO-4217 + amount). Um Quote (Fase 4) pega o preço pela currency do tenant/opportunity.
3. **Moeda base do tenant:** `Company.baseCurrency`.
4. UI CRUD com DS, RBAC, i18n.

## 2. Escopo

### 2.1. Schema Prisma

```prisma
model Product {
  id          String   @id @default(uuid()) @db.Uuid
  companyId   String   @map("company_id") @db.Uuid
  sku         String
  name        String
  description String?
  category    String?
  active      Boolean  @default(true)
  archivedAt  DateTime? @map("archived_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company        @relation(fields: [companyId], references: [id], onDelete: Restrict)
  prices  ProductPrice[]

  @@unique([companyId, sku], name: "uq_product_sku_per_company")
  @@index([companyId, active, updatedAt(sort: Desc)], name: "idx_product_active_recent")
  @@index([companyId, category], name: "idx_product_category")
  @@map("products")
}

model ProductPrice {
  id        String   @id @default(uuid()) @db.Uuid
  productId String   @map("product_id") @db.Uuid
  currency  String   @db.Char(3)
  amount    Decimal  @db.Decimal(18, 4)
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, currency], name: "uq_price_per_product_currency")
  @@map("product_prices")
}
```

`Company` **já tem** campo canônico `baseCurrency String @default("BRL") @db.VarChar(3) @map("base_currency")` (do schema pré-Fase 3). Reutilizar, **não** criar `default_currency`.

### 2.2. Currency allowlist

`src/lib/currency/allowlist.ts`:

```ts
export const SUPPORTED_CURRENCIES = [
  "BRL", "USD", "EUR", "GBP",
  "ARS", "CLP", "MXN", "CAD",
  "AUD", "JPY",
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(code: string): code is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

const LABELS: Record<Currency, string> = {
  BRL: "Real brasileiro (BRL)",
  USD: "Dólar americano (USD)",
  EUR: "Euro (EUR)",
  GBP: "Libra esterlina (GBP)",
  ARS: "Peso argentino (ARS)",
  CLP: "Peso chileno (CLP)",
  MXN: "Peso mexicano (MXN)",
  CAD: "Dólar canadense (CAD)",
  AUD: "Dólar australiano (AUD)",
  JPY: "Iene japonês (JPY)",
};

export function currencyLabel(code: Currency): string {
  return LABELS[code];
}
```

### 2.3. RBAC — novas permissions

Adicionar em `src/lib/rbac/permissions.ts`:

```ts
"products:view",
"products:create",
"products:edit",
"products:delete",
```

Distribuição:
- super_admin, admin: tudo.
- manager: CRUD.
- seller: view.
- viewer: view.

### 2.4. Server Actions

`src/lib/actions/products.ts`:

```ts
listProducts(companyId, filter?: { active?, q?, category? }): ProductItem[]
getProduct(id): ProductItem | null
createProduct(input): { id }
updateProduct(id, patch): ok
archiveProduct(id): ok       // soft
unarchiveProduct(id): ok
deleteProduct(id): ok        // hard; falha se Quote FK-ref (Fase 4)
upsertPrice(productId, currency, amount, active?): ok
deletePrice(productId, currency): ok
```

Todas chamam `requirePermission("products:<action>")` e fazem tenant-scope via `companyId` do session.

### 2.5. UI

`/products` (protegida, `products:view`):
- Header + botão "Novo produto" (`products:create`).
- Filtros: categoria (select de distinct da tabela), status (ativo/arquivado/todos), busca por nome/SKU (debounce 300ms).
- Tabela: SKU, nome, categoria, ativo, N preços, actions (edit/archive/delete).
- Create/Edit dialog: campos basicos + tabela inline de preços (add row, remove row, currency select de allowlist, amount input).
- Archive dialog: confirmação simples.
- Delete dialog: AlertDialog (destrutivo, em Fase 4 passa a bloquear se FK-ref).

### 2.6. i18n

Pack `src/locale/packs/{br,us}/messages/products.json` com:
- `list.title`, `list.empty`, `list.filter.{category,status,search}`
- `form.{sku,name,description,category,active}`
- `form.prices.{title,addCurrency,amount,currency,noPrices}`
- `action.{create,edit,archive,unarchive,delete,confirmArchive,confirmDelete}`

### 2.7. Seed

Estender `prisma/seed.ts`:
- Garantir `baseCurrency="BRL"` nas companies existentes.
- Inserir 6 produtos por company com 2 categorias, cada um com 1-3 prices.

### 2.8. Fora de escopo

- Category como entidade (string por ora).
- Histórico de preço (append-only vs upsert) — upsert por ora, auditoria via audit-log.
- Conversão entre moedas / FX rates — Fase 4 trata snapshot.
- Import CSV de catálogo — Fase 10.
- Imagens de produto.
- Variants / bundle.
- Estoque / inventory.

## 3. Testes

### 3.1. Unit
- `isSupportedCurrency`.
- `Product` helpers (se houver parsing de form).

### 3.2. Integração
- createProduct + upsertPrice em transação.
- SKU duplicado no mesmo tenant → erro; SKU igual em company diferente → ok.
- archiveProduct set `archivedAt` + `active=false`.
- Price amount negativo rejeitado.

### 3.3. E2E
- Admin cria produto com 2 preços (BRL + USD), edita, arquiva.
- Seller vê lista mas não vê botão "Novo produto".
- Filtro por categoria + busca combinam corretamente.

## 4. Riscos

| Risco | Sev | Mitigação |
|-------|-----|-----------|
| Migration de SKU-unique quebra dados legacy | Alto | Não existem dados de Products antes de Fase 3 — zero risco. |
| Decimal JavaScript perde precisão | Alto | Usar `Prisma.Decimal` (decimal.js-light) em todas ops; testar boundary 9999999999999.9999. |
| Currency string arbitrária | Médio | Allowlist checada no Zod schema. |
| SKU com espaços/acentos | Baixo | Normalização (trim + uppercase). |
| Lista carrega todos os produtos (perf) | Médio | Index por `companyId, active, updatedAt DESC` + paginação client-side em 1ª iteração; server-side paginator Fase 10. |

## 5. Aceite

- Migration + seed aplicados; `SELECT COUNT(*) FROM products` = 6 × nº de companies.
- E2E products-crud.spec verde.
- RBAC: seller bloqueado em create/edit/delete.
- Tag `phase-3-deployed`.
- 2+ memory files novos.

## 6. Rollback

`git revert` do merge + migration down (DROP TABLE products/product_prices + DROP COLUMN companies.default_currency).

## 7. Convenção de commits

- `feat(crm): migration products + product_prices + Company.baseCurrency` (schema)
- `feat(crm): currency allowlist + rbac products:*` (matriz)
- `feat(crm): server actions products (CRUD + prices upsert)` (actions)
- `feat(crm): /products UI (list + form + prices inline)` (UI)
- `feat(crm): i18n products br/us + seed 6 produtos por tenant` (i18n+seed)

## 8. Dependências externas

Nenhuma. Prisma, Zod, DS, RBAC de 1c.
