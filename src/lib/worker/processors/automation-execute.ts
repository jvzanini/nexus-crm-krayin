import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { runAction, type ActionSpec, type ActionContext } from "@/lib/automation/actions";
import { checkCircuitBreaker } from "@/lib/automation/guards";
import { AUTOMATION_EXECUTE_QUEUE } from "../queues/automation-execute";

export function startAutomationWorker(): Worker {
  return new Worker(
    AUTOMATION_EXECUTE_QUEUE,
    async (job: Job) => {
      const { executionId } = job.data as { executionId: string };
      const exec = await prisma.workflowExecution.findUnique({
        where: { id: executionId },
        include: { workflow: true },
      });
      if (!exec) {
        logger.warn({ executionId }, "automation.execute.missing");
        return;
      }
      if (exec.workflow.status !== "active") {
        logger.info({ executionId, status: exec.workflow.status }, "automation.execute.skipped_inactive");
        await prisma.workflowExecution.update({
          where: { id: executionId },
          data: { status: "aborted_quota" },
        });
        return;
      }

      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: { status: "running", startedAt: new Date() },
      });

      const ctx: ActionContext = {
        companyId: exec.companyId,
        eventId: exec.eventId,
        payload: (exec.input as unknown as Record<string, unknown>) ?? {},
        chainDepth: exec.chainDepth,
      };

      const actions = (exec.workflow.actions as unknown as ActionSpec[]) ?? [];
      const outputs: unknown[] = [];
      let errored = false;
      let errorMessage: string | null = null;

      for (const spec of actions) {
        try {
          const result = await runAction(spec, ctx);
          outputs.push({ type: spec.type, result });
          if (!result.ok) {
            errored = true;
            errorMessage = JSON.stringify(result.output);
            break;
          }
        } catch (err) {
          errored = true;
          errorMessage = String((err as Error).message ?? err);
          outputs.push({ type: spec.type, error: errorMessage });
          break;
        }
      }

      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: errored ? "failed" : "completed",
          output: { actions: outputs } as any,
          errorMessage,
          finishedAt: new Date(),
        },
      });

      await checkCircuitBreaker(exec.workflowId);
    },
    { connection: redis },
  );
}
