-- Nexus CRM — Fase 1b — Consent LGPD
-- Adiciona campos denormalizados de consent em leads/contacts
-- e cria tabela imutável consent_logs.

BEGIN;

-- ----------------------------------------------------------------------
-- LEADS
-- ----------------------------------------------------------------------
ALTER TABLE "leads"
  ADD COLUMN "consent_marketing"         BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN "consent_marketing_at"      TIMESTAMP(3),
  ADD COLUMN "consent_marketing_ip_mask" TEXT,
  ADD COLUMN "consent_tracking"          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN "consent_tracking_at"       TIMESTAMP(3),
  ADD COLUMN "consent_tracking_ip_mask"  TEXT;

-- ----------------------------------------------------------------------
-- CONTACTS
-- ----------------------------------------------------------------------
ALTER TABLE "contacts"
  ADD COLUMN "consent_marketing"         BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN "consent_marketing_at"      TIMESTAMP(3),
  ADD COLUMN "consent_marketing_ip_mask" TEXT,
  ADD COLUMN "consent_tracking"          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN "consent_tracking_at"       TIMESTAMP(3),
  ADD COLUMN "consent_tracking_ip_mask"  TEXT;

-- ----------------------------------------------------------------------
-- CONSENT_LOGS (imutável; trilha de auditoria LGPD)
-- ----------------------------------------------------------------------
CREATE TABLE "consent_logs" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "subject_type" TEXT         NOT NULL,
  "subject_id"   UUID         NOT NULL,
  "consent_key"  TEXT         NOT NULL,
  "granted"      BOOLEAN      NOT NULL,
  "granted_by"   UUID,
  "granted_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip_mask"      TEXT,
  "user_agent"   VARCHAR(200),
  "source"       TEXT         NOT NULL,
  "reason"       VARCHAR(500),
  CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_consent_log_subject_key_time"
  ON "consent_logs" ("subject_type", "subject_id", "consent_key", "granted_at" DESC);

COMMIT;
