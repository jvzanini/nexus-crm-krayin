"use server";

/**
 * Stubs de server actions do módulo Data Transfer (Fase 10 — wave 10a, T4b).
 *
 * Cada export aqui declara apenas a assinatura final per spec v3 §3.2/§3.3.
 * Implementações reais chegam nas tasks T18 (upload), T19 (parse), T20
 * (preview), T21 (commit), T22a (rollback), T22b (cancel), T22d (preset),
 * T22e (history) e T25 (export).
 *
 * Stubs lançam Error com prefixo `stub: T4b — replace in <TaskN>` para que:
 *  1. UI (10b) possa importar e tipar contra a assinatura final desde já,
 *     destravando paralelismo 10a ↔ 10b.
 *  2. T30 (close 10a) verifique via grep `stub: T4b` em src/app === 0.
 *
 * NÃO REMOVER nenhum stub sem substituir pela implementação real na task
 * indicada — quebra o invariante de close 10a.
 */
import type {
  CancelResult,
  CommitResult,
  Entity,
  ExportOptions,
  ExportResult,
  HistoryItem,
  ListHistoryArgs,
  Locale,
  MappingPreset,
  ParseResult,
  PreviewResult,
  RollbackResult,
  UploadResult,
} from "@/lib/datatransfer/types";

const STUB = (task: string): never => {
  throw new Error(`stub: T4b — replace in ${task}`);
};

export async function uploadImportFile(_formData: FormData): Promise<UploadResult> {
  return STUB("T18");
}

export async function parseImportFile(
  _jobId: string,
  _opts?: { encodingOverride?: string },
): Promise<ParseResult> {
  return STUB("T19");
}

export async function previewImport(
  _jobId: string,
  _mapping: Record<string, string>,
  _locale: Locale,
  _mode: "strict" | "lenient",
  _validateAll?: boolean,
): Promise<PreviewResult> {
  return STUB("T20");
}

export async function commitImport(
  _jobId: string,
  _mapping: Record<string, string>,
  _locale: Locale,
  _mode: "strict" | "lenient",
  _override?: boolean,
): Promise<CommitResult> {
  return STUB("T21");
}

export async function rollbackImport(_jobId: string): Promise<RollbackResult> {
  return STUB("T22a");
}

export async function cancelImport(_jobId: string): Promise<CancelResult> {
  return STUB("T22b");
}

export async function exportEntity(
  _entity: Entity,
  _opts: ExportOptions,
): Promise<ExportResult> {
  return STUB("T25");
}

export async function savePreset(
  _entity: Entity,
  _mapping: Record<string, string>,
): Promise<void> {
  STUB("T22d");
}

export async function getPreset(_entity: Entity): Promise<MappingPreset | null> {
  return STUB("T22d");
}

export async function listHistory(
  _args: ListHistoryArgs,
): Promise<{ items: HistoryItem[]; nextCursor?: string }> {
  return STUB("T22e");
}
