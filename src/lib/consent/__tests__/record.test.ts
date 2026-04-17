import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordConsent, getActiveConsent } from "./record";

type Log = {
  id: string;
  subjectType: string;
  subjectId: string;
  consentKey: string;
  granted: boolean;
  grantedBy: string | null;
  grantedAt: Date;
  ipMask: string | null;
  userAgent: string | null;
  source: string;
  reason: string | null;
};

function makeFakeTx() {
  const logs: (Log & { _seq: number })[] = [];
  let seq = 0;
  const leadUpdates: { id: string; data: Record<string, unknown> }[] = [];
  const contactUpdates: { id: string; data: Record<string, unknown> }[] = [];
  const leads = new Map<string, Record<string, unknown>>();
  const contacts = new Map<string, Record<string, unknown>>();

  const consentLog = {
    findFirst: vi.fn(async ({ where, orderBy }: any) => {
      const match = logs
        .filter(
          (l) =>
            l.subjectType === where.subjectType &&
            l.subjectId === where.subjectId &&
            l.consentKey === where.consentKey,
        )
        .sort((a, b) => {
          const d = b.grantedAt.getTime() - a.grantedAt.getTime();
          if (d !== 0) return orderBy?.grantedAt === "desc" ? d : -d;
          return orderBy?.grantedAt === "desc" ? b._seq - a._seq : a._seq - b._seq;
        });
      return match[0] ?? null;
    }),
    create: vi.fn(async ({ data }: any) => {
      const row = {
        id: `log-${logs.length + 1}`,
        grantedAt: data.grantedAt ?? new Date(),
        _seq: ++seq,
        ...data,
      } as Log & { _seq: number };
      logs.push(row);
      return row;
    }),
  };

  const lead = {
    update: vi.fn(async ({ where, data }: any) => {
      leadUpdates.push({ id: where.id, data });
      const cur = leads.get(where.id) ?? { id: where.id };
      const merged = { ...cur, ...data };
      leads.set(where.id, merged);
      return merged;
    }),
    findUnique: vi.fn(async ({ where }: any) => leads.get(where.id) ?? null),
  };

  const contact = {
    update: vi.fn(async ({ where, data }: any) => {
      contactUpdates.push({ id: where.id, data });
      const cur = contacts.get(where.id) ?? { id: where.id };
      const merged = { ...cur, ...data };
      contacts.set(where.id, merged);
      return merged;
    }),
    findUnique: vi.fn(async ({ where }: any) => contacts.get(where.id) ?? null),
  };

  return {
    tx: { consentLog, lead, contact } as any,
    logs,
    leadUpdates,
    contactUpdates,
  };
}

describe("recordConsent", () => {
  let fx: ReturnType<typeof makeFakeTx>;

  beforeEach(() => {
    fx = makeFakeTx();
  });

  it("grava 2 logs no primeiro registro (marketing=true, tracking=false)", async () => {
    const res = await recordConsent(fx.tx, {
      subjectType: "lead",
      subjectId: "11111111-1111-1111-1111-111111111111",
      consent: { marketing: true, tracking: false },
      source: "lead_form",
      ipMask: "1.2.3.0/24",
      userAgent: "Mozilla",
      grantedBy: null,
    });

    expect(res.changes).toEqual(["marketing", "tracking"]);
    expect(fx.logs).toHaveLength(2);
    expect(fx.logs[0].consentKey).toBe("marketing");
    expect(fx.logs[0].granted).toBe(true);
    expect(fx.logs[1].consentKey).toBe("tracking");
    expect(fx.logs[1].granted).toBe(false);
    expect(fx.leadUpdates).toHaveLength(2);
  });

  it("idempotente: estado igual não gera log novo", async () => {
    const input = {
      subjectType: "lead" as const,
      subjectId: "11111111-1111-1111-1111-111111111111",
      consent: { marketing: true, tracking: false },
      source: "lead_form" as const,
    };
    await recordConsent(fx.tx, input);
    const before = fx.logs.length;
    const res2 = await recordConsent(fx.tx, input);
    expect(res2.changes).toEqual([]);
    expect(fx.logs.length).toBe(before);
  });

  it("parcial: muda só marketing → 1 log adicional", async () => {
    const base = {
      subjectType: "lead" as const,
      subjectId: "22222222-2222-2222-2222-222222222222",
      source: "lead_form" as const,
    };
    await recordConsent(fx.tx, {
      ...base,
      consent: { marketing: false, tracking: false },
    });
    expect(fx.logs).toHaveLength(2);

    const res = await recordConsent(fx.tx, {
      ...base,
      consent: { marketing: true, tracking: false },
    });
    expect(res.changes).toEqual(["marketing"]);
    expect(fx.logs).toHaveLength(3);
  });

  it("trunca userAgent a 200 chars e limpa HTML de reason", async () => {
    await recordConsent(fx.tx, {
      subjectType: "contact",
      subjectId: "33333333-3333-3333-3333-333333333333",
      consent: { marketing: true, tracking: true },
      source: "admin_edit",
      userAgent: "a".repeat(300),
      reason: "Edit <script>alert(1)</script> manual",
    });
    expect(fx.logs[0].userAgent?.length).toBe(200);
    expect(fx.logs[0].reason).toBe("Edit alert(1) manual");
  });
});

describe("getActiveConsent", () => {
  it("retorna último log por key", async () => {
    const fx = makeFakeTx();
    const subjectId = "44444444-4444-4444-4444-444444444444";

    await recordConsent(fx.tx, {
      subjectType: "lead",
      subjectId,
      consent: { marketing: false, tracking: false },
      source: "backfill_migration",
    });
    await recordConsent(fx.tx, {
      subjectType: "lead",
      subjectId,
      consent: { marketing: true, tracking: false },
      source: "lead_form",
    });

    const active = await getActiveConsent(fx.tx, "lead", subjectId);
    expect(active.marketing.granted).toBe(true);
    expect(active.marketing.source).toBe("lead_form");
    expect(active.tracking.granted).toBe(false);
    expect(active.tracking.source).toBe("backfill_migration");
  });

  it("subject sem logs → default granted=false", async () => {
    const fx = makeFakeTx();
    const active = await getActiveConsent(fx.tx, "lead", "no-logs");
    expect(active.marketing.granted).toBe(false);
    expect(active.marketing.at).toBeNull();
    expect(active.tracking.granted).toBe(false);
  });
});
