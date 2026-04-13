import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "@/lib/locale/resolver";
import { loadMessages } from "@/lib/locale/messages";

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = await loadMessages(locale);

  return {
    locale,
    messages,
  };
});
