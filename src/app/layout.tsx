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
  const resolvedTheme = await getResolvedThemeFromCookie();
  const locale = await getLocale();
  const messages = await getMessages();

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
