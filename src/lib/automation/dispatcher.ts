import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { evaluateAll, type Condition } from "./conditions";
import { chainDepthExceeded, incrementQuotaOrReject } from "./guards";
import type { WorkflowTrigger } from "@/generated/prisma/client";
import { automationQueue } from "../worker/queues/automation-execute";

export interface DispatchPayload {
  companyId: string;
  payload: Record<string, unknown>;
  eventId?: string;
  chainDepth?: number;
}

/**
 * Busca workflows ativos para (companyId, trigger), filtra por conditions,
 * cria WorkflowExecution, enqueue job. Idempotência via (workflowId, eventId) unique.
 * Sempre fire-and-forget (não lança).
 */
export async function dispatch(
  trigger: WorkflowTrigger,
  args: DispatchPayload,
): Promise<{ dispatched: number; aborted: number }> {
  const eventId = args.eventId ?? randomUUID();
  const chainDepth = args.chainDepth ?? 0;

  try {
    if (chainDepthExceeded(chainDepth)) {
      logger.warn({ trigger, eventId, chainDepth }, "automation.dispatch.aborted_chain_depth");
      return { dispatched: 0, aborted: 1 };
    }

    const workflows = await prisma.workflow.findMany({
      where: { companyId: args.companyId, status: "active", trigger },
    });

    let dispatched = 0;
    let aborted = 0;

    for (const wf of workflows) {
      const conditions = (wf.conditions as unknown as Condition[]) ?? [];
      if (!evaluateAll(args.payload, conditions)) continue;

      const quota = await incrementQuotaOrReject(args.companyId);
      if (quota.over) {
        // Persiste execution para rastreabilidade
        await prisma.workflowExecution.upsert({
          where: { uq_execution_workflow_event: { workflowId: wf.id, eventId } },
          create: {
            workflowId: wf.id,
            companyId: args.companyId,
            eventId,
            chainDepth,
            status: "aborted_quota",
            input: args.payload as any,
            errorMessage: `Daily quota exceeded (${quota.count})`,
          },
          update: {},
        });
        aborted++;
        continue;
      }

      const exec = await prisma.workflowExecution.upsert({
        where: { uq_execution_workflow_event: { workflowId: wf.id, eventId } },
        create: {
          workflowId: wf.id,
          companyId: args.companyId,
          eventId,
          chainDepth,
          status: "pending",
          input: args.payload as any,
        },
        update: {}, // idempotente: existente não é re-criada
      });

      await automationQueue.add(
        "execute",
        { executionId: exec.id },
        { jobId: `exec-${exec.id}`, removeOnComplete: true, removeOnFail: 1000 },
      );
      dispatched++;
    }

    logger.info({ trigger, eventId, dispatched, aborted, companyId: args.companyId }, "automation.dispatch.done");
    return { dispatched, aborted };
  } catch (err) {
    logger.error({ err, trigger, eventId }, "automation.dispatch.failed");
    return { dispatched: 0, aborted: 0 };
  }
}
