import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, FALLBACK_LOCALE } from "./constants";
import { AVAILABLE_LOCALES } from "@/locale/registry";
import type { LocaleCode } from "@/locale/types";

interface ResolveOptions {
  explicitLangParam?: string;
  session?: { user?: { locale?: string | null } } | null;
}

function isValidLocale(value: string | undefined | null): value is LocaleCode {
  return !!value && AVAILABLE_LOCALES.includes(value as LocaleCode);
}

/**
 * Resolve locale com prioridade:
 * 1. Parâmetro explícito (?lang=)
 * 2. User.locale (da sessão JWT)
 * 3. Cookie NEXT_LOCALE
 * 4. Accept-Language header
 * 5. FALLBACK_LOCALE (pt-BR)
 */
export async function resolveLocale(options?: ResolveOptions): Promise<LocaleCode> {
  // 1. Parâmetro explícito
  if (isValidLocale(options?.explicitLangParam)) {
    return options!.explicitLangParam as LocaleCode;
  }

  // 2. Sessão do usuário
  if (isValidLocale(options?.session?.user?.locale)) {
    return options!.session!.user!.locale as LocaleCode;
  }

  // 3. Cookie
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isValidLocale(cookieLocale)) {
    return cookieLocale as LocaleCode;
  }

  // 4. Accept-Language
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(",")
      .map((part) => part.split(";")[0].trim())
      .find((lang) => isValidLocale(lang));
    if (preferred) return preferred as LocaleCode;
  }

  // 5. Fallback
  return FALLBACK_LOCALE;
}
