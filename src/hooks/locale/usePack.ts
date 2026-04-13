import { useLocaleContext } from "@/components/locale/LocaleClientProvider";
import type { LocalePack } from "@/locale/types";

export function usePack(): LocalePack {
  return useLocaleContext().pack;
}
