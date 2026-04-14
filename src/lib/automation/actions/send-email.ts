import type { ActionExecutor, SendEmailParams } from "./types";
import { logger } from "@/lib/logger";

/**
 * STUB: send-email action depende de Fase 7c sendEmailAction que ainda não existe.
 * Em 8.0 MVP retorna skipped=true com reason clara. Fase 7c fará o wire real.
 */
export const sendEmailExecutor: ActionExecutor<SendEmailParams> = async (_params, ctx) => {
  logger.warn({ eventId: ctx.eventId }, "automation.sendEmail.skipped_awaiting_fase_7c");
  return {
    ok: true,
    skipped: true,
    skipReason: "sendEmailAction não implementada (Fase 7c pendente)",
    output: {},
  };
};
