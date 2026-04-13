import type { LocalePack } from "@/locale/types";
import * as rules from "./rules";
import * as phone from "./phone";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
] as const;

const usPack: LocalePack = {
  code: "en-US",
  name: "English (United States)",
  timezoneDefault: "America/New_York",
  currencyDefault: "USD",
  phoneDefaultCountry: "US",
  recommendedTimezones: [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
    "America/Phoenix",
  ],
  recommendedCurrencies: ["USD", "EUR", "GBP", "CAD"],

  rules: {
    validateTaxIdPersonal: rules.validateSSN,
    validateTaxIdBusiness: rules.validateEIN,
    validatePostalCode: rules.validateZIP,
    validatePhone: phone.validatePhoneUS,
    formatTaxIdPersonal: rules.formatSSN,
    formatTaxIdBusiness: rules.formatEIN,
    formatPostalCode: rules.formatZIP,
    formatPhone: phone.formatPhoneUS,
    maskPhone: phone.maskPhoneUS,
    taxIdPersonalMaxDigits: rules.TAX_ID_PERSONAL_MAX_DIGITS,
    taxIdBusinessMaxDigits: rules.TAX_ID_BUSINESS_MAX_DIGITS,
    postalCodeMaxDigits: rules.POSTAL_CODE_MAX_DIGITS,
  },

  address: {
    visibleFields: ["line1", "line2", "city", "state", "postalCode"],
    requiredFields: ["line1", "city", "state", "postalCode"],
    labelKey: {
      line1: "address.line1_us",
      line2: "address.line2_us",
      neighborhood: "address.neighborhood",
      city: "address.city",
      state: "address.state_us",
      postalCode: "address.postalCode_us",
    },
    states: US_STATES,
  },

  taxIdLabels: {
    personalLabelKey: "common.taxId.personal.ssn",
    businessLabelKey: "common.taxId.business.ein",
  },
};

export default usPack;
