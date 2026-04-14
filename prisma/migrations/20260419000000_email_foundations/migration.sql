BEGIN;
CREATE TYPE "MailboxProvider" AS ENUM ('gmail','outlook','imap_smtp');

CREATE TABLE "mailboxes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "provider" "MailboxProvider" NOT NULL,
  "email_address" TEXT NOT NULL,
  "display_name" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "access_token_enc" TEXT,
  "access_token_exp_at" TIMESTAMP(3),
  "refresh_token_enc" TEXT,
  "imap_host" TEXT, "imap_port" INTEGER,
  "smtp_host" TEXT, "smtp_port" INTEGER,
  "auth_username" TEXT, "auth_password_enc" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_mailbox_user_addr" ON "mailboxes" ("user_id","email_address");
CREATE INDEX "idx_mailbox_active" ON "mailboxes" ("company_id","is_active");

CREATE TABLE "email_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "mailbox_id" UUID NOT NULL,
  "message_id" TEXT NOT NULL,
  "in_reply_to" TEXT,
  "thread_key" TEXT,
  "subject_type" "ActivitySubjectType",
  "subject_id" UUID,
  "activity_id" UUID,
  "from_address" TEXT NOT NULL,
  "to_addresses" TEXT[] NOT NULL DEFAULT '{}',
  "cc_addresses" TEXT[] NOT NULL DEFAULT '{}',
  "bcc_addresses" TEXT[] NOT NULL DEFAULT '{}',
  "subject" VARCHAR(500) NOT NULL,
  "body_text" TEXT,
  "body_html" TEXT,
  "tracking_enabled" BOOLEAN NOT NULL DEFAULT false,
  "opened_at" TIMESTAMP(3),
  "clicked_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "received_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_message_per_tenant" ON "email_messages" ("company_id","message_id");
CREATE INDEX "idx_message_thread" ON "email_messages" ("company_id","thread_key","sent_at" DESC);
CREATE INDEX "idx_message_subject" ON "email_messages" ("company_id","subject_type","subject_id","sent_at" DESC);

ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_mailbox_id_fkey"
  FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
