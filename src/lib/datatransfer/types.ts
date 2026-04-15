/**
 * Contratos TS/Zod públicos do módulo Data Transfer (Fase 10).
 *
 * Esta superfície é estável: importada por server actions (10a),
 * componentes UI (10b) e workers (10a/10c). Mudanças quebram contrato
 * e exigem bump alinhado de produtores+consumidores.
 *
 * Spec: docs/superpowers/specs/2026-04-15-fase-10-datatransfer-v3.md
 */
import { z } from "zod";

// ============================================================
// Enums Zod (canônicos — também referenciados por DataTransferEntity etc no Prisma)
// ============================================================

export const entityEnum = z.enum(["lead", "contact", "opportunity", "product"]);
export type Entity = z.infer<typeof entityEnum>;

export const formatEnum = z.enum(["csv", "xlsx"]);
export type Format = z.infer<typeof formatEnum>;

export const modeEnum = z.enum(["strict", "lenient"]);
export type Mode = z.infer<typeof modeEnum>;

export const dateFormatEnum = z.enum(["iso", "br", "us"]);
export type DateFormat = z.infer<typeof dateFormatEnum>;

export const decimalSepEnum = z.enum([".", ","]);
export type DecimalSep = z.infer<typeof decimalSepEnum>;

// ============================================================
// Locale (passado por `previewImport` / `commitImport` / worker)
// ============================================================

export const localeSchema = z.object({
  dateFormat: dateFormatEnum,
  decimalSep: decimalSepEnum,
});
export type Locale = z.infer<typeof localeSchema>;

// ============================================================
// Resultados de actions
// ============================================================

export type UploadResult =
  | { duplicate: false; jobId: string; quarantineId: string }
  | { duplicate: true; jobId: string; existingJobId: string };

export type ParseResult = {
  rows: number;
  columns: string[];
  sample: Record<string, string>[];
  needsEncoding?: boolean;
  encodingCandidates?: { encoding: string; confidence: number }[];
};

export type PreviewError = {
  row: number;
  field: string;
  code: string;
  message: string;
  rawValue: string;
};

export type PreviewResult = {
  validCount: number;
  errorCount: number;
  errorsByRow: PreviewError[];
  sampleValidated: Record<string, unknown>[];
  validatedAll: boolean;
};

export type CommitResult = { async: boolean; jobId: string; degraded?: boolean };

export type RollbackResult = { removed: number };

export type CancelResult = { ok: boolean };

// ============================================================
// Export
// ============================================================

export type ExportOptions = {
  format: Format;
  columns: string[];
  filters: Record<string, unknown>;
  includeFilters: boolean;
  bom?: boolean;
};

export type ExportResult =
  | { ok: true; signedUrl: string; jobId: string; rowCount: number }
  | { ok: false; code: "EXPORT_TOO_LARGE"; rowCount: number };

// ============================================================
// Mapping preset + histórico
// ============================================================

export type MappingPreset = {
  userId: string;
  entity: Entity;
  mapping: Record<string, string>;
  updatedAt: Date;
};

export type HistoryItem = {
  id: string;
  direction: "import" | "export";
  entity: Entity;
  format: "csv" | "xlsx";
  status: "pending" | "running" | "success" | "failed" | "rolled_back";
  rowCount: number;
  errorCount: number;
  userId: string;
  createdAt: Date;
  errorReportKey?: string | null;
};

export type ListHistoryArgs = {
  cursor?: string;
  limit?: number;
  /** Apenas super_admin com `data-transfer:history:all`. Demais roles ignoram. */
  companyId?: string;
};

// ============================================================
// Worker payload Zod (BullMQ data-transfer-commit queue)
// ============================================================

export const commitJobPayloadSchema = z.object({
  jobId: z.string().uuid(),
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  entity: entityEnum,
  mode: modeEnum,
  locale: localeSchema,
  mapping: z.record(z.string(), z.string()),
});
export type CommitJobPayload = z.infer<typeof commitJobPayloadSchema>;
