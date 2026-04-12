import { NextRequest } from "next/server";
import { auth } from "@/auth";
import Redis from "ioredis";
import { REALTIME_CHANNEL } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Não autorizado", { status: 401 });
  }

  const userId = session.user.id!;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const subscriber = new Redis(process.env.REDIS_URL!);

      // Enviar ping a cada 25s para manter conexão viva
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(pingInterval);
        }
      }, 25_000);

      subscriber.subscribe(REALTIME_CHANNEL, (err) => {
        if (err) {
          controller.error(err);
          return;
        }
      });

      subscriber.on("message", (_channel: string, message: string) => {
        try {
          const event = JSON.parse(message);
          // Filtrar: enviar apenas se sem userId alvo OU se for para este usuário
          if (!event.userId || event.userId === userId) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        } catch {
          // ignorar mensagens malformadas
        }
      });

      req.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        subscriber.unsubscribe();
        subscriber.disconnect();
        try {
          controller.close();
        } catch {
          // já fechado
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
