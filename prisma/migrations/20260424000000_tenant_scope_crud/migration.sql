-- Frente 17: Tenant scoping em leads/contacts/opportunities
-- Adiciona company_id (FK) com backfill para a primeira company existente.
-- Ambientes novos: seed roda depois, dados sempre com companyId correto.
-- Ambientes legados: linhas herdam primeira company (super_admin pode reatribuir).

-- =================== LEAD ===================
ALTER TABLE "leads" ADD COLUMN "company_id" UUID;

UPDATE "leads" SET "company_id" = (
  SELECT "id" FROM "companies" ORDER BY "created_at" ASC LIMIT 1
) WHERE "company_id" IS NULL;

-- Se não existe company nenhuma, apaga leads órfãs (dev limpo / deploy novo).
DELETE FROM "leads" WHERE "company_id" IS NULL;

ALTER TABLE "leads" ALTER COLUMN "company_id" SET NOT NULL;

ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_lead_company_created" ON "leads" ("company_id", "created_at" DESC);

-- =================== CONTACT ===================
ALTER TABLE "contacts" ADD COLUMN "company_id" UUID;

UPDATE "contacts" SET "company_id" = (
  SELECT "id" FROM "companies" ORDER BY "created_at" ASC LIMIT 1
) WHERE "company_id" IS NULL;

DELETE FROM "contacts" WHERE "company_id" IS NULL;

ALTER TABLE "contacts" ALTER COLUMN "company_id" SET NOT NULL;

ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove unique global em email (era @unique); passa a ser (company_id, email).
DROP INDEX IF EXISTS "contacts_email_key";

CREATE UNIQUE INDEX "uq_contact_email_per_company" ON "contacts" ("company_id", "email");
CREATE INDEX "idx_contact_company_created" ON "contacts" ("company_id", "created_at" DESC);

-- =================== OPPORTUNITY ===================
ALTER TABLE "opportunities" ADD COLUMN "company_id" UUID;

UPDATE "opportunities" SET "company_id" = (
  SELECT "id" FROM "companies" ORDER BY "created_at" ASC LIMIT 1
) WHERE "company_id" IS NULL;

DELETE FROM "opportunities" WHERE "company_id" IS NULL;

ALTER TABLE "opportunities" ALTER COLUMN "company_id" SET NOT NULL;

ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_opp_company_created" ON "opportunities" ("company_id", "created_at" DESC);
