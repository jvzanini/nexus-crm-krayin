import type { LocaleCode } from "@/locale/types";

/**
 * Carrega mensagens i18n de um locale específico.
 * Lazy import para bundle splitting — cada pack carrega apenas quando necessário.
 */
export async function loadMessages(locale: LocaleCode) {
  switch (locale) {
    case "pt-BR": {
      const [common, auth, validation, address] = await Promise.all([
        import("@/locale/packs/br/messages/common.json"),
        import("@/locale/packs/br/messages/auth.json"),
        import("@/locale/packs/br/messages/validation.json"),
        import("@/locale/packs/br/messages/address.json"),
      ]);
      return {
        common: common.default,
        auth: auth.default,
        validation: validation.default,
        address: address.default,
      };
    }
    case "en-US": {
      const [common, auth, validation, address] = await Promise.all([
        import("@/locale/packs/us/messages/common.json"),
        import("@/locale/packs/us/messages/auth.json"),
        import("@/locale/packs/us/messages/validation.json"),
        import("@/locale/packs/us/messages/address.json"),
      ]);
      return {
        common: common.default,
        auth: auth.default,
        validation: validation.default,
        address: address.default,
      };
    }
    default:
      throw new Error(`Unsupported locale: ${locale}`);
  }
}
