import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkDb(): Promise<"fulfilled" | "rejected"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "fulfilled";
  } catch (err) {
    logger.warn({ err }, "ready.db.check_failed");
    return "rejected";
  }
}

async function checkRedis(): Promise<"fulfilled" | "rejected"> {
  try {
    const pong = await redis.ping();
    return pong === "PONG" ? "fulfilled" : "rejected";
  } catch (err) {
    logger.warn({ err }, "ready.redis.check_failed");
    return "rejected";
  }
}

/**
 * Readiness probe. 200 quando DB + Redis respondem; 503 caso contrário.
 * Portainer / load balancer usa este endpoint para decidir se roteia tráfego.
 */
export async function GET() {
  const [db, cache] = await Promise.all([checkDb(), checkRedis()]);
  const ok = db === "fulfilled" && cache === "fulfilled";

  return NextResponse.json(
    {
      status: ok ? "ready" : "degraded",
      db,
      redis: cache,
      version: process.env.APP_VERSION ?? "unknown",
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
