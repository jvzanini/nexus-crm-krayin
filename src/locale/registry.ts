import type { LocalePack, LocaleCode } from "./types";
import brPack from "./packs/br/pack";
import usPack from "./packs/us/pack";

export const LOCALE_PACKS: Record<LocaleCode, LocalePack> = {
  "pt-BR": brPack,
  "en-US": usPack,
};

export function getLocalePack(code: LocaleCode): LocalePack {
  return LOCALE_PACKS[code];
}

export const AVAILABLE_LOCALES: ReadonlyArray<LocaleCode> = Object.keys(
  LOCALE_PACKS,
) as LocaleCode[];
