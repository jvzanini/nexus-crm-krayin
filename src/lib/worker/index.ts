// Worker BullMQ — processa filas de email, outbox, activity-reminders e automation-execute
// Bundled via esbuild (ver Dockerfile)

import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { Resend } from "resend";
import { reenqueuePendingReminders } from "./boot";
import { startActivityReminderWorker } from "./processors/activity-reminder";
import { startAutomationWorker } from "./processors/automation-execute";
import { startMarketingSendWorker } from "./processors/marketing-send";
import { logger } from "@/lib/logger";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? "re_missing_key");
  }
  return _resend;
}

// ============================================================
// Worker: email
// ============================================================

const emailWorker = new Worker(
  "email",
  async (job: Job) => {
    const { to, subject, html } = job.data;
    const from = process.env.EMAIL_FROM || "Nexus CRM <contato@nexusai360.com>";

    await getResend().emails.send({ from, to, subject, html });
    logger.info({ queue: "email", to, subject }, "worker.email.sent");
  },
  { connection }
);

emailWorker.on("failed", (job, err) => {
  logger.error({ queue: "email", jobId: job?.id, err }, "worker.email.failed");
});

// ============================================================
// Worker: outbox
// ============================================================

const outboxWorker = new Worker(
  "outbox",
  async (job: Job) => {
    const { eventId, eventType, aggregateId, payload } = job.data;

    // Processar evento outbox — marcar como processado no DB via REST interno
    const baseUrl = process.env.NEXTAUTH_URL || "http://app:3000";
    const res = await fetch(`${baseUrl}/api/internal/outbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": process.env.WORKER_SECRET || "",
      },
      body: JSON.stringify({ eventId, eventType, aggregateId, payload }),
    });

    if (!res.ok) {
      throw new Error(`Outbox API retornou ${res.status}`);
    }

    logger.info({ queue: "outbox", eventId, eventType }, "worker.outbox.processed");
  },
  { connection }
);

outboxWorker.on("failed", (job, err) => {
  logger.error({ queue: "outbox", jobId: job?.id, err }, "worker.outbox.failed");
});

// ============================================================
// Worker: activity-reminders
// ============================================================

const activityReminderWorker = startActivityReminderWorker();

// ============================================================
// Worker: automation-execute
// ============================================================

const automationWorker = startAutomationWorker();

// ============================================================
// Worker: marketing-send
// ============================================================

const marketingWorker = startMarketingSendWorker();

// ============================================================
// Boot: reenqueue lembretes pendentes
// ============================================================

reenqueuePendingReminders().catch((err) => {
  logger.error({ err }, "worker.reminder.reenqueue_boot.failed");
});

// ============================================================
// Graceful shutdown
// ============================================================

async function shutdown() {
  logger.info({}, "worker.shutdown.start");
  await Promise.all([
    emailWorker.close(),
    outboxWorker.close(),
    activityReminderWorker.close(),
    automationWorker.close(),
    marketingWorker.close(),
  ]);
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

logger.info({ queues: ["email", "outbox", "activity-reminders", "automation-execute", "marketing-send"] }, "worker.startup.ready");
