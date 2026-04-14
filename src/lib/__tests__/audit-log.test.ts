import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { configureAudit, resetAudit, type AuditEntry } from "@nexusai360/audit-log";

describe("auditLog (wrapper de @nexusai360/audit-log)", () => {
  let captured: AuditEntry[];
  let mod: typeof import("../audit-log");

  beforeEach(async () => {
    captured = [];
    configureAudit(async (entry) => {
      captured.push(entry);
    });
    vi.resetModules();
    mod = await import("../audit-log");
  });

  afterEach(() => {
    resetAudit();
  });

  it("delega para logAudit do pacote com mapeamento direto", async () => {
    await mod.auditLog({
      actorType: "user" as any,
      actorId: "u1",
      actorLabel: "alice",
      action: "user.login",
      resourceType: "User",
    });
    // logAudit é sync com persist async; aguardar microtask
    await new Promise((r) => setImmediate(r));
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      actorType: "user",
      actorId: "u1",
      actorLabel: "alice",
      action: "user.login",
      resourceType: "User",
    });
  });

  it("actorId undefined → empty string no entry (persist normaliza para null)", async () => {
    await mod.auditLog({
      actorType: "system" as any,
      actorLabel: "scheduler",
      action: "cron.tick",
      resourceType: "Cron",
    });
    await new Promise((r) => setImmediate(r));
    expect(captured[0].actorId).toBe("");
  });

  it("preserva before/after/details/companyId/resourceId/ipAddress/userAgent", async () => {
    await mod.auditLog({
      actorType: "user" as any,
      actorId: "u1",
      actorLabel: "alice",
      action: "lead.update",
      resourceType: "Lead",
      resourceId: "lead_42",
      companyId: "c1",
      before: { status: "open" },
      after: { status: "won" },
      details: { reason: "manual" },
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });
    await new Promise((r) => setImmediate(r));
    expect(captured[0]).toMatchObject({
      resourceId: "lead_42",
      companyId: "c1",
      before: { status: "open" },
      after: { status: "won" },
      details: { reason: "manual" },
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    });
  });
});
