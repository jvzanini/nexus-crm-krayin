/**
 * Contrato comum de Action Executors.
 * Cada executor é uma função pura-ish que recebe params + context e retorna output.
 */
export type EntityType = "lead" | "contact" | "opportunity";

export interface ActionContext {
  companyId: string;
  /** eventId do WorkflowExecution (rastreabilidade). */
  eventId: string;
  /** Payload do trigger (serializado do evento). */
  payload: Record<string, unknown>;
  /** chainDepth para propagar em disparos downstream. */
  chainDepth: number;
}

export interface ActionResult {
  ok: boolean;
  output: Record<string, unknown>;
  skipped?: boolean;
  skipReason?: string;
}

export type ActionExecutor<P> = (params: P, ctx: ActionContext) => Promise<ActionResult>;

// Param types por action
export interface UpdateFieldParams {
  entityType: EntityType;
  idField: string; // path no payload para extrair o id
  field: string;
  value: unknown;
}

export interface CreateTaskParams {
  title: string;
  assignedTo?: string;
  dueInHours?: number;
  subjectIdField?: string; // path no payload (default "id"); entity assume "lead"|"contact"|"opportunity"
  subjectType?: EntityType;
}

export interface AssignUserParams {
  entityType: EntityType;
  idField: string;
  userId: string;
}

export interface SendEmailParams {
  mailboxId: string;
  subject: string;
  bodyHtml: string;
  toField: string; // path no payload (ex.: "email")
}
