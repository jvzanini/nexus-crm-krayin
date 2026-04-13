import type { LocalePack } from "@/locale/types";
import * as rules from "./rules";
import * as phone from "./phone";

const BR_STATES = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
] as const;

const brPack: LocalePack = {
  code: "pt-BR",
  name: "Português (Brasil)",
  timezoneDefault: "America/Sao_Paulo",
  currencyDefault: "BRL",
  phoneDefaultCountry: "BR",
  recommendedTimezones: [
    "America/Sao_Paulo",
    "America/Manaus",
    "America/Bahia",
    "America/Fortaleza",
    "America/Recife",
    "America/Cuiaba",
    "America/Belem",
    "America/Campo_Grande",
  ],
  recommendedCurrencies: ["BRL", "USD", "EUR"],

  rules: {
    validateTaxIdPersonal: rules.validateCPF,
    validateTaxIdBusiness: rules.validateCNPJ,
    validatePostalCode: rules.validateCEP,
    validatePhone: phone.validatePhoneBR,
    formatTaxIdPersonal: rules.formatCPF,
    formatTaxIdBusiness: rules.formatCNPJ,
    formatPostalCode: rules.formatCEP,
    formatPhone: phone.formatPhoneBR,
    maskPhone: phone.maskPhoneBR,
    taxIdPersonalMaxDigits: rules.TAX_ID_PERSONAL_MAX_DIGITS,
    taxIdBusinessMaxDigits: rules.TAX_ID_BUSINESS_MAX_DIGITS,
    postalCodeMaxDigits: rules.POSTAL_CODE_MAX_DIGITS,
  },

  address: {
    visibleFields: ["line1", "line2", "neighborhood", "city", "state", "postalCode"],
    requiredFields: ["line1", "neighborhood", "city", "state", "postalCode"],
    labelKey: {
      line1: "address.line1_br",
      line2: "address.line2_br",
      neighborhood: "address.neighborhood",
      city: "address.city",
      state: "address.state_br",
      postalCode: "address.postalCode_br",
    },
    states: BR_STATES,
  },

  taxIdLabels: {
    personalLabelKey: "common.taxId.personal.cpf",
    businessLabelKey: "common.taxId.business.cnpj",
  },
};

export default brPack;
