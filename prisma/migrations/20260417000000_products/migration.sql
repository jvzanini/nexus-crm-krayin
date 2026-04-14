-- Migration: products + product_prices (Fase 3 T1)
-- Criado em: 2026-04-17

BEGIN;

-- Tabela: products
CREATE TABLE "products" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "company_id"  UUID        NOT NULL,
    "sku"         TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "description" TEXT,
    "category"    TEXT,
    "active"      BOOLEAN     NOT NULL DEFAULT true,
    "archived_at" TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- Tabela: product_prices
CREATE TABLE "product_prices" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID         NOT NULL,
    "currency"   CHAR(3)      NOT NULL,
    "amount"     DECIMAL(18,4) NOT NULL,
    "active"     BOOLEAN      NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- Índices: products
CREATE UNIQUE INDEX "uq_product_sku_per_company"
    ON "products" ("company_id", "sku");

CREATE INDEX "idx_product_active_recent"
    ON "products" ("company_id", "active", "updated_at" DESC);

CREATE INDEX "idx_product_category"
    ON "products" ("company_id", "category");

-- Índices: product_prices
CREATE UNIQUE INDEX "uq_price_per_product_currency"
    ON "product_prices" ("product_id", "currency");

-- Foreign keys: products → companies
ALTER TABLE "products"
    ADD CONSTRAINT "products_company_id_fkey"
    FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Foreign keys: product_prices → products
ALTER TABLE "product_prices"
    ADD CONSTRAINT "product_prices_product_id_fkey"
    FOREIGN KEY ("product_id")
    REFERENCES "products" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

COMMIT;
