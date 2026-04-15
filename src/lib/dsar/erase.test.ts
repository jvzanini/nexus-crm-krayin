import { describe, it, expect, vi } from "vitest";
import { anonymizeSubject, buildErasedEmail, ERASED_NAME_MARKER } from "./erase";

describe("anonymizeSubject (helpers puros)", () => {
  it("buildErasedEmail retorna formato @anon.local", () => {
    const e = buildErasedEmail("abc");
    expect(e).toMatch(/^erased-\d+-[a-z0-9]+@anon\.local$/);
  });
  it("ERASED_NAME_MARKER é constante estável", () => {
    expect(ERASED_NAME_MARKER).toBe("[DSAR ERASED]");
  });
});

describe("anonymizeSubject (lead)", () => {
  it("updates lead com email anon, name marker, limpa phone/notes/ip_masks; cria audit + consent log", async () => {
    const tx = {
      lead: {
        update: vi.fn(async () => ({ id: "l1" })),
      },
      contact: { update: vi.fn() },
      opportunity: { update: vi.fn() },
      activity: {
        updateMany: vi.fn(async () => ({ count: 3 })),
      },
      consentLog: {
        create: vi.fn(async () => ({ id: "c1" })),
        findFirst: vi.fn(async () => null),
      },
    };

    const res = await anonymizeSubject(tx as any, {
      subjectType: "lead",
      subjectId: "l1",
      reason: "titular solicitou",
      actorId: "admin-1",
    });

    expect(res.ok).toBe(true);
    expect(tx.lead.update).toHaveBeenCalledTimes(1);
    const updateCall = tx.lead.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: "l1" });
    expect(updateCall.data.name).toBe(ERASED_NAME_MARKER);
    expect(updateCall.data.email).toMatch(/@anon\.local$/);
    expect(updateCall.data.phone).toBeNull();
    expect(updateCall.data.notes).toBeNull();
    expect(updateCall.data.consentMarketingIpMask).toBeNull();
    expect(updateCall.data.consentTrackingIpMask).toBeNull();

    expect(tx.activity.updateMany).toHaveBeenCalledWith({
      where: { subjectType: "lead", subjectId: "l1" },
      data: { description: null, location: null },
    });

    expect(tx.consentLog.create).toHaveBeenCalled();
    const logCalls = tx.consentLog.create.mock.calls.map((c: any[]) => c[0].data);
    // Dois consent logs: marketing + tracking com source="dsar" e reason mencionando erased_by_dsar
    expect(logCalls.length).toBe(2);
    for (const log of logCalls) {
      expect(log.source).toBe("dsar");
      expect(log.reason).toContain("erased_by_dsar");
    }
  });
});

describe("anonymizeSubject — custom attributes piiMasked", () => {
  function mkTx(opts: {
    leadRecord: { companyId: string; custom: Record<string, unknown> };
    defs: Array<{ key: string; piiMasked: boolean; entity: string }>;
  }) {
    return {
      lead: {
        update: vi.fn(async () => ({ id: "l1" })),
        findUnique: vi.fn(async () => ({ id: "l1", ...opts.leadRecord })),
      },
      contact: { update: vi.fn(), findUnique: vi.fn(async () => null) },
      opportunity: { update: vi.fn(), findUnique: vi.fn(async () => null) },
      activity: { updateMany: vi.fn(async () => ({ count: 0 })) },
      consentLog: { create: vi.fn(async () => ({ id: "c1" })) },
      customAttribute: { findMany: vi.fn(async () => opts.defs) },
    };
  }

  it("anonymize zera APENAS keys piiMasked=true do custom (preserva non-PII)", async () => {
    const tx = mkTx({
      leadRecord: {
        companyId: "co1",
        custom: { cpf: "123.456.789-00", mrr: 5000, notes: "privado" },
      },
      defs: [
        { key: "cpf", piiMasked: true, entity: "lead" },
        { key: "notes", piiMasked: true, entity: "lead" },
        { key: "mrr", piiMasked: false, entity: "lead" },
      ],
    });

    await anonymizeSubject(tx as any, {
      subjectType: "lead",
      subjectId: "l1",
      actorId: "admin-1",
    });

    expect(tx.lead.update).toHaveBeenCalled();
    const updateData = ((tx.lead.update.mock.calls as any[])[0][0] as any).data as any;
    expect(updateData.custom).toBeDefined();
    expect(updateData.custom.cpf).toBeNull();
    expect(updateData.custom.notes).toBeNull();
    expect(updateData.custom.mrr).toBe(5000);
  });

  it("sem defs piiMasked, custom existente fica intacto no update", async () => {
    const tx = mkTx({
      leadRecord: { companyId: "co1", custom: { mrr: 1000 } },
      defs: [{ key: "mrr", piiMasked: false, entity: "lead" }],
    });

    await anonymizeSubject(tx as any, {
      subjectType: "lead",
      subjectId: "l1",
      actorId: "admin-1",
    });

    const updateData = ((tx.lead.update.mock.calls as any[])[0][0] as any).data as any;
    // Sem keys piiMasked, `custom` não precisa ser alterado — aceita ausente OU igual ao original
    if ("custom" in updateData) {
      expect(updateData.custom).toEqual({ mrr: 1000 });
    }
  });
});
