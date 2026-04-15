import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import {
  dataTransferEvents,
  type DataTransferAction,
} from "../data-transfer";

const JOB_UUID = randomUUID();

describe("data-transfer audit events", () => {
  it("registra 8 eventos canônicos", () => {
    const expected: DataTransferAction[] = [
      "data_transfer.import.uploaded",
      "data_transfer.import.previewed",
      "data_transfer.import.committed",
      "data_transfer.import.rolled_back",
      "data_transfer.import.cancelled",
      "data_transfer.export.generated",
      "data_transfer.export.downloaded",
      "data_transfer.history.purged",
    ];
    expect(Object.keys(dataTransferEvents).sort()).toEqual([...expected].sort());
  });

  it("import.uploaded payload válido requer jobId/entity/filename/sizeBytes/fileHash", () => {
    const schema = dataTransferEvents["data_transfer.import.uploaded"];
    expect(
      schema.safeParse({
        jobId: JOB_UUID,
        entity: "lead",
        filename: "leads.csv",
        sizeBytes: 1234,
        fileHash: "abc123",
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ jobId: "bad" }).success).toBe(false);
  });

  it("import.previewed payload válido", () => {
    const schema = dataTransferEvents["data_transfer.import.previewed"];
    const r = schema.safeParse({
      jobId: JOB_UUID,
      validCount: 100,
      errorCount: 5,
      mode: "lenient",
    });
    expect(r.success).toBe(true);
  });

  it("import.committed payload válido", () => {
    const schema = dataTransferEvents["data_transfer.import.committed"];
    expect(
      schema.safeParse({
        jobId: JOB_UUID,
        rowCount: 500,
        errorCount: 0,
        durationMs: 1234,
        async: false,
      }).success,
    ).toBe(true);
  });

  it("import.rolled_back payload válido", () => {
    const schema = dataTransferEvents["data_transfer.import.rolled_back"];
    expect(
      schema.safeParse({
        jobId: JOB_UUID,
        rowCountRemoved: 250,
        reason: "user_request",
      }).success,
    ).toBe(true);
  });

  it("import.cancelled payload válido", () => {
    const schema = dataTransferEvents["data_transfer.import.cancelled"];
    expect(
      schema.safeParse({
        jobId: JOB_UUID,
        reason: "CANCELLED_BY_USER",
      }).success,
    ).toBe(true);
  });

  it("export.generated payload válido", () => {
    const schema = dataTransferEvents["data_transfer.export.generated"];
    expect(
      schema.safeParse({
        jobId: JOB_UUID,
        entity: "lead",
        format: "csv",
        rowCount: 100,
        columnCount: 12,
        durationMs: 456,
      }).success,
    ).toBe(true);
  });

  it("export.downloaded payload válido", () => {
    const schema = dataTransferEvents["data_transfer.export.downloaded"];
    expect(
      schema.safeParse({
        jobId: JOB_UUID,
        actorIp: "10.0.0.1",
        userAgent: "Mozilla/5.0",
      }).success,
    ).toBe(true);
  });

  it("history.purged payload válido", () => {
    const schema = dataTransferEvents["data_transfer.history.purged"];
    expect(
      schema.safeParse({ removedJobs: 23, cutoffDate: "2026-01-15" }).success,
    ).toBe(true);
  });
});
