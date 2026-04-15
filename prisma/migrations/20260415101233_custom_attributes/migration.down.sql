-- Rollback manual para Fase 5 Custom Attributes.
-- Prisma NÃO executa este arquivo automaticamente.
-- Execução: psql $DATABASE_URL -f migration.down.sql (coordenado pelo DBA).
--
-- AVISO: este rollback APAGA dados em custom_attributes e zera a coluna
-- `custom` das tabelas leads/contacts/opportunities. Trabalhar em janela
-- de manutenção e confirmar backup antes.

BEGIN;

-- GIN indexes manuais
DROP INDEX IF EXISTS "idx_opportunity_custom";
DROP INDEX IF EXISTS "idx_contact_custom";
DROP INDEX IF EXISTS "idx_lead_custom";

-- Foreign keys
ALTER TABLE "custom_attributes" DROP CONSTRAINT IF EXISTS "custom_attributes_company_id_fkey";

-- Tabelas
DROP TABLE IF EXISTS "custom_attribute_unique_refs";
DROP TABLE IF EXISTS "custom_attributes";

-- Colunas JSONB
ALTER TABLE "opportunities" DROP COLUMN IF EXISTS "custom";
ALTER TABLE "contacts"      DROP COLUMN IF EXISTS "custom";
ALTER TABLE "leads"         DROP COLUMN IF EXISTS "custom";

-- Enums (depois das tabelas)
DROP TYPE IF EXISTS "CustomAttributeStatus";
DROP TYPE IF EXISTS "CustomAttributeType";
DROP TYPE IF EXISTS "CustomAttributeEntity";

COMMIT;
