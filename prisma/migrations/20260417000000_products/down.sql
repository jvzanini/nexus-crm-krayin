-- Rollback: products + product_prices (Fase 3 T1)
-- Ordem inversa: product_prices primeiro (FK para products)

BEGIN;

DROP TABLE "product_prices";
DROP TABLE "products";

COMMIT;
