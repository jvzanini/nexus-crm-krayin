import type { LocaleCode } from "@/locale/types";

/**
 * Carrega mensagens i18n de um locale específico.
 * Lazy import para bundle splitting — cada pack carrega apenas quando necessário.
 */
export async function loadMessages(locale: LocaleCode) {
  switch (locale) {
    case "pt-BR": {
      const [common, auth, validation, address, consent, products, activities, mailboxes] = await Promise.all([
        import("@/locale/packs/br/messages/common.json"),
        import("@/locale/packs/br/messages/auth.json"),
        import("@/locale/packs/br/messages/validation.json"),
        import("@/locale/packs/br/messages/address.json"),
        import("@/locale/packs/br/messages/consent.json"),
        import("@/locale/packs/br/messages/products.json"),
        import("@/locale/packs/br/messages/activities.json"),
        import("@/locale/packs/br/messages/mailboxes.json"),
      ]);
      return {
        common: common.default,
        auth: auth.default,
        validation: validation.default,
        address: address.default,
        consent: consent.default,
        products: products.default,
        activities: activities.default,
        mailboxes: mailboxes.default,
      };
    }
    case "en-US": {
      const [common, auth, validation, address, consent, products, activities, mailboxes] = await Promise.all([
        import("@/locale/packs/us/messages/common.json"),
        import("@/locale/packs/us/messages/auth.json"),
        import("@/locale/packs/us/messages/validation.json"),
        import("@/locale/packs/us/messages/address.json"),
        import("@/locale/packs/us/messages/consent.json"),
        import("@/locale/packs/us/messages/products.json"),
        import("@/locale/packs/us/messages/activities.json"),
        import("@/locale/packs/us/messages/mailboxes.json"),
      ]);
      return {
        common: common.default,
        auth: auth.default,
        validation: validation.default,
        address: address.default,
        consent: consent.default,
        products: products.default,
        activities: activities.default,
        mailboxes: mailboxes.default,
      };
    }
    default:
      throw new Error(`Unsupported locale: ${locale}`);
  }
}
