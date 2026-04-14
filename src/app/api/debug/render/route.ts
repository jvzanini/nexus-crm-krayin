import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, { ok: boolean; error?: string }> = {};
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");

  async function probe(name: string, fn: () => unknown) {
    try {
      const out = fn();
      results[name] = { ok: true, error: `ok len=${String(out).length}` };
    } catch (err) {
      const e = err as Error;
      results[name] = {
        ok: false,
        error: `${e.name}: ${e.message}\n${e.stack?.split("\n").slice(0, 12).join("\n")}`,
      };
    }
  }

  await probe("render_next_intl_provider", async () => {
    const { NextIntlClientProvider } = await import("next-intl");
    const el = React.createElement(
      NextIntlClientProvider as React.FC<{ locale: string; messages: Record<string, unknown>; children: React.ReactNode }>,
      { locale: "pt-BR", messages: { test: "hi" }, children: React.createElement("div", null, "ok") },
    );
    return renderToStaticMarkup(el);
  });

  await probe("render_session_provider", async () => {
    const { SessionProvider } = await import("next-auth/react");
    const el = React.createElement(
      SessionProvider as React.FC<{ children: React.ReactNode }>,
      { children: React.createElement("div", null, "ok") },
    );
    return renderToStaticMarkup(el);
  });

  await probe("render_providers", async () => {
    const { Providers } = await import("@/components/providers/theme-provider");
    const el = React.createElement(
      Providers as React.FC<{ initialTheme: "dark" | "light"; children: React.ReactNode }>,
      { initialTheme: "dark", children: React.createElement("div", null, "ok") },
    );
    return renderToStaticMarkup(el);
  });

  await probe("render_toaster", async () => {
    const { Toaster } = await import("@/components/providers/toaster");
    const el = React.createElement(Toaster as React.FC);
    return renderToStaticMarkup(el);
  });

  return NextResponse.json(results, { status: 200 });
}
