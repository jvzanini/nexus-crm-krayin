import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Theme } from "@/generated/prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { theme } = await req.json();
    if (!["dark", "light", "system"].includes(theme)) {
      return NextResponse.json({ error: "Tema inválido" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { theme: theme as Theme },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
