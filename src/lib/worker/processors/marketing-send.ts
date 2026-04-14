import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { canSendMarketing } from "@/lib/consent";
import { incrementQuotaOrReject } from "@/lib/automation/guards";
import { signUnsubscribeToken } from "@/lib/marketing/unsubscribe-token";
import { MARKETING_SEND_QUEUE } from "../queues/marketing-send";

const MARKETING_DAILY_QUOTA = Number(process.env.MARKETING_DAILY_QUOTA ?? 5000);

async function sendEmailStub(_args: {
  mailboxId: string;
  to: string[];
  subject: string;
  bodyHtml: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string; skipped?: boolean }> {
  // STUB — aguarda Fase 7c sendEmailAction.
  return { ok: true, skipped: true, messageId: `stub-${Date.now()}` };
}

export function startMarketingSendWorker(): Worker {
  return new Worker(
    MARKETING_SEND_QUEUE,
    async (job: Job) => {
      const { recipientId } = job.data as { recipientId: string };

      const recipient = await prisma.campaignRecipient.findUnique({
        where: { id: recipientId },
        include: { campaign: true },
      });
      if (!recipient) {
        logger.warn({ recipientId }, "marketing.send.recipient_missing");
        return;
      }
      if (recipient.status !== "pending") {
        return; // já processado
      }
      if (recipient.campaign.status !== "sending") {
        return; // campanha pausada/cancelada — skip
      }

      // Re-check consent
      const canSend = await canSendMarketing(prisma, recipient.contactId, "contact");
      if (!canSend) {
        await prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: { status: "skipped_consent" },
        });
        return;
      }

      // Quota
      const q = await incrementQuotaOrReject(recipient.campaign.companyId, MARKETING_DAILY_QUOTA);
      if (q.over) {
        await prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: { status: "skipped_quota" },
        });
        await prisma.campaign.update({
          where: { id: recipient.campaign.id },
          data: { status: "paused" },
        });
        logger.warn(
          { campaignId: recipient.campaign.id, quota: q.count },
          "marketing.campaign.paused_quota",
        );
        return;
      }

      const contact = await prisma.contact.findFirst({
        where: { id: recipient.contactId, companyId: recipient.campaign.companyId },
      });
      if (!contact || !contact.email) {
        await prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: { status: "failed", errorMessage: "Contato sem e-mail" },
        });
        return;
      }

      const token = signUnsubscribeToken({
        contactId: recipient.contactId,
        campaignId: recipient.campaignId,
      });
      const unsubscribeLink = `/unsubscribe/${token}`;
      const footer = `<hr><p style="font-size:12px;color:#6b7280">Se não deseja mais receber estes e-mails, <a href="${unsubscribeLink}">cancele a inscrição</a>.</p>`;
      const bodyHtmlFinal = recipient.campaign.bodyHtml + footer;

      const result = await sendEmailStub({
        mailboxId: recipient.campaign.mailboxId,
        to: [contact.email],
        subject: recipient.campaign.subject,
        bodyHtml: bodyHtmlFinal,
      });

      if (result.ok) {
        await prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: {
            status: "sent",
            sentAt: new Date(),
            messageId: result.messageId ?? null,
          },
        });
        logger.info(
          { recipientId, campaignId: recipient.campaignId, stub: result.skipped },
          "marketing.send.ok",
        );
      } else {
        await prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: { status: "failed", errorMessage: result.error ?? "Erro desconhecido" },
        });
        logger.warn({ recipientId, campaignId: recipient.campaignId }, "marketing.send.failed");
      }
    },
    { connection: redis },
  );
}
