-- CreateEnum SavedFilterModule (idempotente)
DO $$ BEGIN
  CREATE TYPE "SavedFilterModule" AS ENUM (
    'leads',
    'contacts',
    'opportunities',
    'products',
    'tasks',
    'campaigns',
    'segments',
    'workflows'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable saved_filters
CREATE TABLE IF NOT EXISTS "saved_filters" (
  "id"         UUID               NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID               NOT NULL,
  "company_id" UUID               NOT NULL,
  "module_key" "SavedFilterModule" NOT NULL,
  "name"       VARCHAR(80)        NOT NULL,
  "filters"    JSONB              NOT NULL DEFAULT '{}',
  "is_default" BOOLEAN            NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3)       NOT NULL,
  CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique + índices)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_saved_filter_name"
  ON "saved_filters" ("user_id", "company_id", "module_key", "name");

CREATE INDEX IF NOT EXISTS "idx_saved_filter_scope"
  ON "saved_filters" ("user_id", "company_id", "module_key");

CREATE INDEX IF NOT EXISTS "idx_saved_filter_default"
  ON "saved_filters" ("user_id", "company_id", "module_key", "is_default");

-- Foreign Keys
DO $$ BEGIN
  ALTER TABLE "saved_filters"
    ADD CONSTRAINT "saved_filters_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "saved_filters"
    ADD CONSTRAINT "saved_filters_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
