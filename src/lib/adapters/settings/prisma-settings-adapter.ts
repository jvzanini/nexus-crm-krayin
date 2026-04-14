import type { SettingsAdapter } from "@nexusai360/settings-ui/server-helpers";
import { prisma } from "@/lib/prisma";

export class PrismaSettingsAdapter implements SettingsAdapter {
  async getAllSettings(): Promise<Record<string, unknown>> {
    const rows = await prisma.globalSettings.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value as unknown]));
  }

  async getSetting(key: string): Promise<unknown | null> {
    const row = await prisma.globalSettings.findUnique({ where: { key } });
    return row ? (row.value as unknown) : null;
  }

  async setSetting(key: string, value: unknown, updatedBy: string): Promise<void> {
    // Prisma Json field aceita JsonValue; forçamos cast pois SettingsAdapter usa unknown
    const jsonValue = value as never;
    await prisma.globalSettings.upsert({
      where: { key },
      update: { value: jsonValue, updatedBy },
      create: { key, value: jsonValue, updatedBy },
    });
  }
}
