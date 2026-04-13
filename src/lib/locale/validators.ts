import { z } from "zod";
import { getLocalePack } from "@/locale/registry";
import type { LocaleCode } from "@/locale/types";

export function createTaxIdPersonalSchema(locale: LocaleCode) {
  const pack = getLocalePack(locale);
  return z.string().refine(
    (val) => pack.rules.validateTaxIdPersonal(val),
    { message: `validation.taxId.personal.invalid` }
  );
}

export function createTaxIdBusinessSchema(locale: LocaleCode) {
  const pack = getLocalePack(locale);
  return z.string().refine(
    (val) => pack.rules.validateTaxIdBusiness(val),
    { message: `validation.taxId.business.invalid` }
  );
}

export function createPostalCodeSchema(locale: LocaleCode) {
  const pack = getLocalePack(locale);
  return z.string().refine(
    (val) => pack.rules.validatePostalCode(val),
    { message: `validation.postalCode.invalid` }
  );
}

export function createPhoneSchema(locale: LocaleCode) {
  const pack = getLocalePack(locale);
  return z.string().refine(
    (val) => pack.rules.validatePhone(val),
    { message: `validation.phone.invalid` }
  );
}

export function optionalRegional<T extends z.ZodTypeAny>(schema: T) {
  return schema.optional().or(z.literal(""));
}
