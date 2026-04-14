export type ConsentKey = "marketing" | "tracking";

export type ConsentSource =
  | "lead_form"
  | "contact_form"
  | "admin_edit"
  | "backfill_migration";

export type SubjectType = "lead" | "contact";

export interface ConsentInput {
  marketing: boolean;
  tracking: boolean;
}

export interface RecordConsentInput {
  subjectType: SubjectType;
  subjectId: string;
  consent: ConsentInput;
  source: ConsentSource;
  ipMask?: string | null;
  userAgent?: string | null;
  grantedBy?: string | null;
  reason?: string | null;
}

export interface ActiveConsentEntry {
  granted: boolean;
  at: Date | null;
  source: ConsentSource | null;
}

export type ActiveConsent = Record<ConsentKey, ActiveConsentEntry>;

export const CONSENT_KEYS: readonly ConsentKey[] = ["marketing", "tracking"] as const;
