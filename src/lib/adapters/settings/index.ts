import { PrismaSettingsAdapter } from "./prisma-settings-adapter";
import { PrismaFlagsAdapter } from "./prisma-flags-adapter";

export const settingsAdapter = new PrismaSettingsAdapter();
export const flagsAdapter = new PrismaFlagsAdapter();

export { PrismaSettingsAdapter, PrismaFlagsAdapter };
