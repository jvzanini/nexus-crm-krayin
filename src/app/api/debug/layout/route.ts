import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint temporário de debug para diagnosticar falha no root layout.
 * Executa cada chamada async do layout em sequência e reporta qual falhou.
 * REMOVER assim que produção estabilizar.
 */
export async function GET() {
  const results: Record<string, { ok: boolean; error?: string; value?: unknown }> = {};

  try {
    const { getResolvedThemeFromCookie } = await import("@/lib/theme");
    const theme = await getResolvedThemeFromCookie();
    results.theme = { ok: true, value: theme };
  } catch (err) {
    results.theme = {
      ok: false,
      error: `${(err as Error).name}: ${(err as Error).message}\n${(err as Error).stack?.split("\n").slice(0, 5).join("\n")}`,
    };
  }

  try {
    const { getLocale } = await import("next-intl/server");
    const locale = await getLocale();
    results.locale = { ok: true, value: locale };
  } catch (err) {
    results.locale = {
      ok: false,
      error: `${(err as Error).name}: ${(err as Error).message}\n${(err as Error).stack?.split("\n").slice(0, 5).join("\n")}`,
    };
  }

  try {
    const { getMessages } = await import("next-intl/server");
    const messages = await getMessages();
    results.messages = {
      ok: true,
      value: { keys: Object.keys(messages as Record<string, unknown>), count: Object.keys(messages as Record<string, unknown>).length },
    };
  } catch (err) {
    results.messages = {
      ok: false,
      error: `${(err as Error).name}: ${(err as Error).message}\n${(err as Error).stack?.split("\n").slice(0, 8).join("\n")}`,
    };
  }

  // Testa barrel DS (suspeito)
  try {
    const ds = await import("@nexusai360/design-system");
    const exported = Object.keys(ds);
    results.design_system_barrel = { ok: true, value: { count: exported.length, sample: exported.slice(0, 10) } };
  } catch (err) {
    results.design_system_barrel = {
      ok: false,
      error: `${(err as Error).name}: ${(err as Error).message}\n${(err as Error).stack?.split("\n").slice(0, 8).join("\n")}`,
    };
  }

  // Prisma
  try {
    const { prisma } = await import("@/lib/prisma");
    const userCount = await prisma.user.count();
    results.prisma_user_count = { ok: true, value: userCount };
  } catch (err) {
    results.prisma_user_count = {
      ok: false,
      error: `${(err as Error).name}: ${(err as Error).message}\n${(err as Error).stack?.split("\n").slice(0, 5).join("\n")}`,
    };
  }

  return NextResponse.json(results, { status: 200 });
}
