// Worker BullMQ — processa filas de email, outbox e activity-reminders
// Bundled via esbuild (ver Dockerfile)

import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { Resend } from "resend";
import { reenqueuePendingReminders } from "./boot";
import { startActivityReminderWorker } from "./processors/activity-reminder";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================================
// Worker: email
// ============================================================

const emailWorker = new Worker(
  "email",
  async (job: Job) => {
    const { to, subject, html } = job.data;
    const from = process.env.EMAIL_FROM || "Nexus CRM <contato@nexusai360.com>";

    await resend.emails.send({ from, to, subject, html });
    console.log(`[worker:email] Enviado para ${to}: ${subject}`);
  },
  { connection }
);

emailWorker.on("failed", (job, err) => {
  console.error(`[worker:email] Job ${job?.id} falhou:`, err.message);
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

    console.log(`[worker:outbox] Evento ${eventType} (${eventId}) processado`);
  },
  { connection }
);

outboxWorker.on("failed", (job, err) => {
  console.error(`[worker:outbox] Job ${job?.id} falhou:`, err.message);
});

// ============================================================
// Worker: activity-reminders
// ============================================================

const activityReminderWorker = startActivityReminderWorker();

// ============================================================
// Boot: reenqueue lembretes pendentes
// ============================================================

reenqueuePendingReminders().catch((err) => {
  console.error("[worker] Falha no reenqueue de lembretes:", err);
});

// ============================================================
// Graceful shutdown
// ============================================================

async function shutdown() {
  console.log("[worker] Encerrando workers...");
  await Promise.all([
    emailWorker.close(),
    outboxWorker.close(),
    activityReminderWorker.close(),
  ]);
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[worker] Workers iniciados — email, outbox, activity-reminders");
