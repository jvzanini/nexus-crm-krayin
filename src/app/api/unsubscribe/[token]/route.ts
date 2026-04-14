import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordConsent } from "@/lib/consent";
import { verifyUnsubscribeToken } from "@/lib/marketing/unsubscribe-token";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = verifyUnsubscribeToken(token);

  if (!result.ok) {
    logger.warn({ reason: result.reason }, "unsubscribe.invalid_token");
    return new Response(renderPage("Link inválido ou expirado."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const { contactId, campaignId } = result.payload;

  try {
    await prisma.$transaction(async (tx) => {
      const contact = await tx.contact.findUnique({ where: { id: contactId } });
      if (!contact) return;

      await recordConsent(tx as any, {
        subjectType: "contact",
        subjectId: contactId,
        consent: { marketing: false, tracking: contact.consentTracking },
        source: "campaign_unsubscribe",
      });

      await tx.campaignRecipient.updateMany({
        where: { campaignId, contactId },
        data: { status: "unsubscribed", unsubscribedAt: new Date() },
      });
    });

    logger.info({ contactId, campaignId }, "unsubscribe.processed");
    return new Response(renderPage("Inscrição cancelada com sucesso."), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    logger.error({ err, contactId, campaignId }, "unsubscribe.failed");
    return new Response(renderPage("Erro ao processar desinscrição."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

function renderPage(message: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${message}</title><style>body{font-family:system-ui;max-width:480px;margin:4rem auto;padding:1rem;color:#111}.card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:1.5rem}</style></head><body><div class="card"><h1>${message}</h1><p>Você não receberá mais e-mails de marketing deste remetente.</p></div></body></html>`;
}
