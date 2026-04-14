import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/providers/toaster";
import { Providers } from "@/components/providers/theme-provider";
import { LocaleClientProvider } from "@/components/locale/LocaleClientProvider";
import { getResolvedThemeFromCookie } from "@/lib/theme";
import { APP_CONFIG } from "@/lib/app.config";
import "@nexusai360/design-system/styles.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_CONFIG.name,
  description: APP_CONFIG.description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Debug temporário: se algo throw, expor erro cru em vez de 500 opaco.
  let resolvedTheme: Awaited<ReturnType<typeof getResolvedThemeFromCookie>>;
  let locale: string;
  let messages: Awaited<ReturnType<typeof getMessages>>;
  try {
    resolvedTheme = await getResolvedThemeFromCookie();
    locale = await getLocale();
    messages = await getMessages();
  } catch (err) {
    const e = err as Error;
    return (
      <html lang="pt-BR">
        <body style={{ background: "#0a0a0a", color: "#fff", fontFamily: "monospace", padding: "16px" }}>
          <h1 style={{ color: "#ff6b6b" }}>ROOT LAYOUT ERROR</h1>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "13px" }}>
            {`${e.name}: ${e.message}\n\n${e.stack ?? "(no stack)"}`}
          </pre>
        </body>
      </html>
    );
  }

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${geistMono.variable} ${resolvedTheme} h-full antialiased`}
      style={{ colorScheme: resolvedTheme }}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LocaleClientProvider locale={locale}>
            <Providers initialTheme={resolvedTheme}>
              {children}
              <Toaster />
            </Providers>
          </LocaleClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
