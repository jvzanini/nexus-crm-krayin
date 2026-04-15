-- CreateEnum
CREATE TYPE "DataTransferDirection" AS ENUM ('import', 'export');

-- CreateEnum
CREATE TYPE "DataTransferEntity" AS ENUM ('lead', 'contact', 'opportunity', 'product');

-- CreateEnum
CREATE TYPE "DataTransferFormat" AS ENUM ('csv', 'xlsx');

-- CreateEnum
CREATE TYPE "DataTransferStatus" AS ENUM ('pending', 'running', 'success', 'failed', 'rolled_back');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "import_job_id" UUID;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "import_job_id" UUID;

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "import_job_id" UUID;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "import_job_id" UUID;

-- CreateTable
CREATE TABLE "data_transfer_jobs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "direction" "DataTransferDirection" NOT NULL,
    "entity" "DataTransferEntity" NOT NULL,
    "format" "DataTransferFormat" NOT NULL,
    "status" "DataTransferStatus" NOT NULL DEFAULT 'pending',
    "quarantine_id" UUID,
    "file_hash" VARCHAR(64),
    "filename" VARCHAR(255),
    "size_bytes" BIGINT,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "error_report_key" TEXT,
    "custom_attrs_snapshot" JSONB,
    "progress" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_transfer_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_transfer_mapping_presets" (
    "user_id" UUID NOT NULL,
    "entity" "DataTransferEntity" NOT NULL,
    "mapping" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_transfer_mapping_presets_pkey" PRIMARY KEY ("user_id","entity")
);

-- CreateIndex
CREATE INDEX "idx_dtj_company_recent" ON "data_transfer_jobs"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_dtj_queue" ON "data_transfer_jobs"("status", "started_at");

-- CreateIndex
CREATE INDEX "idx_dtj_dedupe" ON "data_transfer_jobs"("company_id", "entity", "file_hash", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_lead_import_job" ON "leads"("company_id", "import_job_id");

-- CreateIndex
CREATE INDEX "idx_contact_import_job" ON "contacts"("company_id", "import_job_id");

-- CreateIndex
CREATE INDEX "idx_opportunity_import_job" ON "opportunities"("company_id", "import_job_id");

-- CreateIndex
CREATE INDEX "idx_product_import_job" ON "products"("company_id", "import_job_id");

-- AddForeignKey
ALTER TABLE "data_transfer_jobs" ADD CONSTRAINT "data_transfer_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfer_jobs" ADD CONSTRAINT "data_transfer_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_transfer_mapping_presets" ADD CONSTRAINT "data_transfer_mapping_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

