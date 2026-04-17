import { describe, it, expect, vi } from "vitest";
import { buildSubjectExport, type SubjectType } from "../export";

function mkPrismaMock(opts?: {
  leadCustom?: Record<string, unknown>;
  customAttrDefs?: Array<{ key: string; piiMasked: boolean; entity: string }>;
  leadCompanyId?: string;
}) {
  const custom = opts?.leadCustom ?? {};
  const defs = opts?.customAttrDefs ?? [];
  return {
    lead: {
      findUnique: vi.fn(async () => ({
        id: "l1",
        companyId: opts?.leadCompanyId ?? "co1",
        name: "Joao",
        email: "joao@example.com",
        phone: "+5511999999999",
        custom,
        createdAt: new Date("2025-01-01"),
      })),
    },
    contact: { findUnique: vi.fn(async () => null) },
    opportunity: { findUnique: vi.fn(async () => null) },
    activity: {
      findMany: vi.fn(async () => [
        { id: "a1", type: "call", title: "primeiro contato", createdAt: new Date("2025-01-02") },
      ]),
    },
    consentLog: {
      findMany: vi.fn(async () => [
        { id: "c1", consentKey: "marketing", granted: true, grantedAt: new Date("2025-01-01") },
      ]),
    },
    emailMessage: {
      findMany: vi.fn(async () => [
        { id: "m1", messageId: "<x@crm>", subject: "boas vindas", sentAt: new Date("2025-01-03") },
      ]),
    },
    auditLog: {
      findMany: vi.fn(async () => [
        { id: "au1", action: "lead.created", createdAt: new Date("2025-01-01") },
      ]),
    },
    customAttribute: {
      findMany: vi.fn(async () => defs),
    },
  };
}

describe("buildSubjectExport", () => {
  it("lead export inclui subject + activities + emails + consent_logs + audit_logs", async () => {
    const prismaMock = mkPrismaMock();
    const result = await buildSubjectExport(prismaMock as any, "lead", "l1");

    expect(result.subjectType).toBe("lead");
    expect(result.subjectId).toBe("l1");
    expect(result.subject).toEqual(expect.objectContaining({ id: "l1", name: "Joao" }));
    expect(result.activities).toHaveLength(1);
    expect(result.emails).toHaveLength(1);
    expect(result.consentLogs).toHaveLength(1);
    expect(result.auditLogs).toHaveLength(1);
    expect(result.exportedAt).toBeInstanceOf(Date);
  });

  it("subject inexistente lança SubjectNotFoundError", async () => {
    const prismaMock = mkPrismaMock();
    prismaMock.lead.findUnique = vi.fn(async () => null);
    await expect(buildSubjectExport(prismaMock as any, "lead", "missing")).rejects.toThrow("SUBJECT_NOT_FOUND");
  });

  it("subjectType inválido lança", async () => {
    await expect(
      buildSubjectExport({} as any, "xyz" as SubjectType, "l1"),
    ).rejects.toThrow("INVALID_SUBJECT_TYPE");
  });

  it("custom com piiMasked=true é substituído por ***REDACTED*** no export", async () => {
    const prismaMock = mkPrismaMock({
      leadCustom: { cpf: "123.456.789-00", mrr: 5000 },
      customAttrDefs: [
        { key: "cpf", piiMasked: true, entity: "lead" },
        { key: "mrr", piiMasked: false, entity: "lead" },
      ],
    });
    const result = await buildSubjectExport(prismaMock as any, "lead", "l1");
    const subjectCustom = (result.subject as any).custom;
    expect(subjectCustom.cpf).toBe("***REDACTED***");
    expect(subjectCustom.mrr).toBe(5000);
  });

  it("sem defs piiMasked o custom do subject é mantido inalterado", async () => {
    const prismaMock = mkPrismaMock({
      leadCustom: { foo: "bar", mrr: 1000 },
      customAttrDefs: [{ key: "mrr", piiMasked: false, entity: "lead" }],
    });
    const result = await buildSubjectExport(prismaMock as any, "lead", "l1");
    expect((result.subject as any).custom).toEqual({ foo: "bar", mrr: 1000 });
  });
});
