import type { ActionContext, ActionResult } from "./types";
import { updateFieldExecutor } from "./update-field";
import { createTaskExecutor } from "./create-task";
import { assignUserExecutor } from "./assign-user";
import { sendEmailExecutor } from "./send-email";

export type ActionSpec =
  | { type: "update-field"; params: Parameters<typeof updateFieldExecutor>[0] }
  | { type: "create-task"; params: Parameters<typeof createTaskExecutor>[0] }
  | { type: "assign-user"; params: Parameters<typeof assignUserExecutor>[0] }
  | { type: "send-email"; params: Parameters<typeof sendEmailExecutor>[0] };

export async function runAction(spec: ActionSpec, ctx: ActionContext): Promise<ActionResult> {
  switch (spec.type) {
    case "update-field":
      return updateFieldExecutor(spec.params, ctx);
    case "create-task":
      return createTaskExecutor(spec.params, ctx);
    case "assign-user":
      return assignUserExecutor(spec.params, ctx);
    case "send-email":
      return sendEmailExecutor(spec.params, ctx);
  }
}

export type { ActionContext, ActionResult } from "./types";
