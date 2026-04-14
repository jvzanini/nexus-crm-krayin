BEGIN;

CREATE TYPE "CampaignStatus" AS ENUM (
  'draft', 'scheduled', 'sending', 'sent', 'paused', 'canceled', 'failed'
);

CREATE TYPE "RecipientStatus" AS ENUM (
  'pending', 'sent', 'failed', 'skipped_consent', 'skipped_quota',
  'bounced', 'complained', 'unsubscribed'
);

CREATE TABLE "segments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "filters" JSONB NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_segment_recent" ON "segments" ("company_id", "updated_at" DESC);

CREATE TABLE "campaigns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "subject" VARCHAR(500) NOT NULL,
  "body_html" TEXT NOT NULL,
  "mailbox_id" UUID NOT NULL,
  "segment_id" UUID NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
  "scheduled_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "batch_size" INTEGER NOT NULL DEFAULT 100,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_campaign_queue" ON "campaigns" ("company_id", "status", "scheduled_at");

CREATE TABLE "campaign_recipients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "message_id" TEXT,
  "status" "RecipientStatus" NOT NULL DEFAULT 'pending',
  "error_message" TEXT,
  "sent_at" TIMESTAMP(3),
  "opened_at" TIMESTAMP(3),
  "clicked_at" TIMESTAMP(3),
  "unsubscribed_at" TIMESTAMP(3),
  CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_recipient_per_contact" ON "campaign_recipients" ("campaign_id", "contact_id");
CREATE INDEX "idx_recipient_status" ON "campaign_recipients" ("campaign_id", "status");

ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_segment_id_fkey"
  FOREIGN KEY ("segment_id") REFERENCES "segments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "campaign_recipients"
  ADD CONSTRAINT "campaign_recipients_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
