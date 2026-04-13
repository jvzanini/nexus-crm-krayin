"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit-log";
import { AVAILABLE_LOCALES } from "@/locale/registry";
import { LOCALE_COOKIE, COOKIE_MAX_AGE } from "@/lib/locale/constants";
import type { LocaleCode } from "@/locale/types";

type ActionResult<T = void> = { success: boolean; data?: T; error?: string };

function isValidLocale(value: string): value is LocaleCode {
  return AVAILABLE_LOCALES.includes(value as LocaleCode);
}

export async function setUserLocale(locale: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Não autenticado" };
    if (!isValidLocale(locale)) return { success: false, error: "Idioma inválido" };

    await prisma.user.update({
      where: { id: user.id },
      data: { locale },
    });

    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
    });

    auditLog({
      actorType: "user",
      actorId: user.id,
      actorLabel: user.name || user.email,
      action: "locale.user_changed",
      resourceType: "user",
      resourceId: user.id,
      details: { locale },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[setUserLocale]", error);
    return { success: false, error: "Erro ao alterar idioma" };
  }
}

export async function setUserTimezone(timezone: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Não autenticado" };

    await prisma.user.update({
      where: { id: user.id },
      data: { timezone },
    });

    auditLog({
      actorType: "user",
      actorId: user.id,
      actorLabel: user.name || user.email,
      action: "locale.user_timezone_changed",
      resourceType: "user",
      resourceId: user.id,
      details: { timezone },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[setUserTimezone]", error);
    return { success: false, error: "Erro ao alterar fuso horário" };
  }
}

export async function setCompanyLocale(
  companyId: string,
  locale: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Não autenticado" };
    if (!isValidLocale(locale)) return { success: false, error: "Idioma inválido" };

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return { success: false, error: "Empresa não encontrada" };

    const previousLocale = company.locale;

    await prisma.company.update({
      where: { id: companyId },
      data: {
        locale,
        localeChangedAt: new Date(),
        localeChangedBy: user.id,
      },
    });

    auditLog({
      actorType: "user",
      actorId: user.id,
      actorLabel: user.name || user.email,
      companyId,
      action: "locale.company_changed",
      resourceType: "company",
      resourceId: companyId,
      details: { from: previousLocale, to: locale },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[setCompanyLocale]", error);
    return { success: false, error: "Erro ao alterar idioma da empresa" };
  }
}

export async function setCompanyTimezone(
  companyId: string,
  timezone: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Não autenticado" };

    await prisma.company.update({
      where: { id: companyId },
      data: { defaultTimezone: timezone },
    });

    auditLog({
      actorType: "user",
      actorId: user.id,
      actorLabel: user.name || user.email,
      companyId,
      action: "locale.company_timezone_changed",
      resourceType: "company",
      resourceId: companyId,
      details: { timezone },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[setCompanyTimezone]", error);
    return { success: false, error: "Erro ao alterar fuso horário da empresa" };
  }
}

export async function setCompanyBaseCurrency(
  companyId: string,
  currency: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Não autenticado" };

    await prisma.company.update({
      where: { id: companyId },
      data: { baseCurrency: currency },
    });

    auditLog({
      actorType: "user",
      actorId: user.id,
      actorLabel: user.name || user.email,
      companyId,
      action: "locale.company_currency_changed",
      resourceType: "company",
      resourceId: companyId,
      details: { currency },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[setCompanyBaseCurrency]", error);
    return { success: false, error: "Erro ao alterar moeda da empresa" };
  }
}
