BEGIN;

DROP TABLE "workflow_executions";
DROP TABLE "workflows";
DROP TYPE "ExecutionStatus";
DROP TYPE "WorkflowStatus";
DROP TYPE "WorkflowTrigger";

COMMIT;
