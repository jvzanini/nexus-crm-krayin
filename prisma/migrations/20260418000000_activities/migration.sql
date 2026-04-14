BEGIN;

CREATE TYPE "ActivityType" AS ENUM ('call','meeting','task','note','file');
CREATE TYPE "ActivityStatus" AS ENUM ('pending','completed','canceled');
CREATE TYPE "ActivitySubjectType" AS ENUM ('lead','contact','opportunity');

CREATE TABLE "activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "type" "ActivityType" NOT NULL,
  "status" "ActivityStatus" NOT NULL DEFAULT 'pending',
  "subject_type" "ActivitySubjectType" NOT NULL,
  "subject_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "scheduled_at" TIMESTAMP(3),
  "timezone" VARCHAR(64),
  "duration_min" INTEGER,
  "location" TEXT,
  "due_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "reminder_at" TIMESTAMP(3),
  "reminder_job_id" TEXT,
  "assigned_to" UUID,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_activity_timeline"
  ON "activities" ("company_id","subject_type","subject_id","scheduled_at" DESC);

CREATE INDEX "idx_activity_mytasks"
  ON "activities" ("company_id","assigned_to","status","due_at");

CREATE INDEX "idx_activity_reminder_due"
  ON "activities" ("reminder_at");

CREATE TABLE "activity_files" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "activity_id" UUID NOT NULL,
  "storage_key" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime_type" VARCHAR(128) NOT NULL,
  "size" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID NOT NULL,
  CONSTRAINT "activity_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_activity_file_by_activity" ON "activity_files" ("activity_id");

ALTER TABLE "activity_files"
  ADD CONSTRAINT "activity_files_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
