-- Rollback: products + product_prices (Fase 3 T1)
-- Ordem inversa: product_prices primeiro (FK para products)

BEGIN;

DROP TABLE IF EXISTS "product_prices";
DROP TABLE IF EXISTS "products";

COMMIT;
