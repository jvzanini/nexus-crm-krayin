import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers/theme-provider";
import { getResolvedThemeFromCookie } from "@/lib/theme";
import { APP_CONFIG } from "@/lib/app.config";
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

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} ${resolvedTheme} h-full antialiased`}
      style={{ colorScheme: resolvedTheme }}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers initialTheme={resolvedTheme}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
