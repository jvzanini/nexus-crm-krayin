-- CreateEnum
CREATE TYPE "CustomAttributeEntity" AS ENUM ('lead', 'contact', 'opportunity');

-- CreateEnum
CREATE TYPE "CustomAttributeType" AS ENUM ('text', 'number', 'date', 'datetime', 'boolean', 'select', 'multi_select', 'url');

-- CreateEnum
CREATE TYPE "CustomAttributeStatus" AS ENUM ('active', 'deleting');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "custom" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "custom" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "custom" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "custom_attributes" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entity" "CustomAttributeEntity" NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "type" "CustomAttributeType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "is_unique" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB DEFAULT '[]',
    "default_value" JSONB,
    "placeholder" VARCHAR(200),
    "help_text" VARCHAR(500),
    "min_length" INTEGER,
    "max_length" INTEGER,
    "min_value" DECIMAL(12,4),
    "max_value" DECIMAL(12,4),
    "position" INTEGER NOT NULL DEFAULT 0,
    "visible_in_list" BOOLEAN NOT NULL DEFAULT false,
    "searchable" BOOLEAN NOT NULL DEFAULT false,
    "sortable" BOOLEAN NOT NULL DEFAULT false,
    "pii_masked" BOOLEAN NOT NULL DEFAULT false,
    "status" "CustomAttributeStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_attribute_unique_refs" (
    "id" UUID NOT NULL,
    "entity" "CustomAttributeEntity" NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "ref_count" INTEGER NOT NULL DEFAULT 0,
    "index_name" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_attribute_unique_refs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_custom_attr_form_order" ON "custom_attributes"("company_id", "entity", "position");

-- CreateIndex
CREATE UNIQUE INDEX "custom_attributes_company_id_entity_key_key" ON "custom_attributes"("company_id", "entity", "key");

-- CreateIndex
CREATE UNIQUE INDEX "custom_attribute_unique_refs_entity_key_key" ON "custom_attribute_unique_refs"("entity", "key");

-- AddForeignKey
ALTER TABLE "custom_attributes" ADD CONSTRAINT "custom_attributes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GIN indexes manuais para busca em colunas JSONB `custom`.
-- NÃO declarados no schema.prisma (Prisma não suporta GIN com jsonb_ops nativamente).
CREATE INDEX "idx_lead_custom"        ON "leads"         USING gin ("custom" jsonb_ops);
CREATE INDEX "idx_contact_custom"     ON "contacts"      USING gin ("custom" jsonb_ops);
CREATE INDEX "idx_opportunity_custom" ON "opportunities" USING gin ("custom" jsonb_ops);
