BEGIN;

-- Enums
CREATE TYPE "WorkflowTrigger" AS ENUM ('lead_created', 'contact_created', 'activity_completed');
CREATE TYPE "WorkflowStatus" AS ENUM ('draft', 'active', 'paused');
CREATE TYPE "ExecutionStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'aborted_chain_depth', 'aborted_quota');

-- Table: workflows
CREATE TABLE "workflows" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id"   UUID NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "trigger"      "WorkflowTrigger" NOT NULL,
    "conditions"   JSONB NOT NULL,
    "actions"      JSONB NOT NULL,
    "status"       "WorkflowStatus" NOT NULL DEFAULT 'draft',
    "version"      INTEGER NOT NULL DEFAULT 1,
    "last_edit_by" UUID,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- Table: workflow_executions
CREATE TABLE "workflow_executions" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id"   UUID NOT NULL,
    "company_id"    UUID NOT NULL,
    "event_id"      TEXT NOT NULL,
    "chain_depth"   INTEGER NOT NULL DEFAULT 0,
    "status"        "ExecutionStatus" NOT NULL DEFAULT 'pending',
    "input"         JSONB NOT NULL,
    "output"        JSONB,
    "error_message" TEXT,
    "started_at"    TIMESTAMP(3),
    "finished_at"   TIMESTAMP(3),

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- Unique index
CREATE UNIQUE INDEX "uq_execution_workflow_event" ON "workflow_executions"("workflow_id", "event_id");

-- Dispatch index
CREATE INDEX "idx_workflow_dispatch" ON "workflows"("company_id", "status", "trigger");

-- Recent executions index
CREATE INDEX "idx_execution_recent" ON "workflow_executions"("company_id", "status", "started_at" DESC);

-- Foreign key
ALTER TABLE "workflow_executions"
    ADD CONSTRAINT "workflow_executions_workflow_id_fkey"
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
