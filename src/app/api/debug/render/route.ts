import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tenta renderizar Providers + LoginContent e captura qualquer erro.
 * REMOVER quando prod estabilizar.
 */
export async function GET() {
  const results: Record<string, { ok: boolean; error?: string }> = {};

  // Test: import + render NextIntlClientProvider
  try {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { NextIntlClientProvider } = await import("next-intl");
    const html = renderToStaticMarkup(
      React.createElement(
        NextIntlClientProvider,
        { locale: "pt-BR", messages: { test: "hi" } },
        React.createElement("div", {}, "ok"),
      ),
    );
    results.render_next_intl_provider = { ok: true, error: `html_len=${html.length}` };
  } catch (err) {
    const e = err as Error;
    results.render_next_intl_provider = {
      ok: false,
      error: `${e.name}: ${e.message}\n${e.stack?.split("\n").slice(0, 10).join("\n")}`,
    };
  }

  // Test: import + render SessionProvider
  try {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { SessionProvider } = await import("next-auth/react");
    const html = renderToStaticMarkup(
      React.createElement(SessionProvider, {}, React.createElement("div", {}, "ok")),
    );
    results.render_session_provider = { ok: true, error: `html_len=${html.length}` };
  } catch (err) {
    const e = err as Error;
    results.render_session_provider = {
      ok: false,
      error: `${e.name}: ${e.message}\n${e.stack?.split("\n").slice(0, 10).join("\n")}`,
    };
  }

  // Test: Providers (theme-provider + SessionProvider wrapped)
  try {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { Providers } = await import("@/components/providers/theme-provider");
    const html = renderToStaticMarkup(
      React.createElement(Providers, { initialTheme: "dark" }, React.createElement("div", {}, "ok")),
    );
    results.render_providers = { ok: true, error: `html_len=${html.length}` };
  } catch (err) {
    const e = err as Error;
    results.render_providers = {
      ok: false,
      error: `${e.name}: ${e.message}\n${e.stack?.split("\n").slice(0, 10).join("\n")}`,
    };
  }

  // Test: render Toaster
  try {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { Toaster } = await import("@/components/providers/toaster");
    const html = renderToStaticMarkup(React.createElement(Toaster));
    results.render_toaster = { ok: true, error: `html_len=${html.length}` };
  } catch (err) {
    const e = err as Error;
    results.render_toaster = {
      ok: false,
      error: `${e.name}: ${e.message}\n${e.stack?.split("\n").slice(0, 10).join("\n")}`,
    };
  }

  return NextResponse.json(results, { status: 200 });
}
