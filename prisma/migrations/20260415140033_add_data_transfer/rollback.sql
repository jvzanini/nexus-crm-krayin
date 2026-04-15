-- Rollback for migration 20260415140033_add_data_transfer
-- Order: DROP INDEX (entity import_job indexes) -> ALTER DROP COLUMN -> DROP INDEX (dtj indexes) -> DROP TABLE -> DROP TYPE.
-- Idempotent (IF EXISTS).

-- Drop FK first (entity -> data_transfer_jobs softcols are unconstrained, but presets/jobs FKs target users/companies).
ALTER TABLE "data_transfer_jobs" DROP CONSTRAINT IF EXISTS "data_transfer_jobs_company_id_fkey";
ALTER TABLE "data_transfer_jobs" DROP CONSTRAINT IF EXISTS "data_transfer_jobs_user_id_fkey";
ALTER TABLE "data_transfer_mapping_presets" DROP CONSTRAINT IF EXISTS "data_transfer_mapping_presets_user_id_fkey";

-- Drop indexes on entity tables (added by softcols).
DROP INDEX IF EXISTS "idx_lead_import_job";
DROP INDEX IF EXISTS "idx_contact_import_job";
DROP INDEX IF EXISTS "idx_opportunity_import_job";
DROP INDEX IF EXISTS "idx_product_import_job";

-- Drop softcols.
ALTER TABLE "leads"         DROP COLUMN IF EXISTS "import_job_id";
ALTER TABLE "contacts"      DROP COLUMN IF EXISTS "import_job_id";
ALTER TABLE "opportunities" DROP COLUMN IF EXISTS "import_job_id";
ALTER TABLE "products"      DROP COLUMN IF EXISTS "import_job_id";

-- Drop indexes on data_transfer_jobs.
DROP INDEX IF EXISTS "idx_dtj_company_recent";
DROP INDEX IF EXISTS "idx_dtj_queue";
DROP INDEX IF EXISTS "idx_dtj_dedupe";

-- Drop tables.
DROP TABLE IF EXISTS "data_transfer_mapping_presets";
DROP TABLE IF EXISTS "data_transfer_jobs";

-- Drop enum types.
DROP TYPE IF EXISTS "DataTransferStatus";
DROP TYPE IF EXISTS "DataTransferFormat";
DROP TYPE IF EXISTS "DataTransferEntity";
DROP TYPE IF EXISTS "DataTransferDirection";
