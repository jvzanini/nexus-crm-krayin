/**
 * Fase 5 — T15/34: integração custom attributes em leads actions.
 *
 * Cobre:
 *  - createLead com custom válido persiste `custom:{...}` no Prisma.create.
 *  - createLead com custom inválido (tipo errado) retorna erro de validação.
 *  - createLead com payload > 32KB rejeita com CustomAttrBytesExceededError.
 *  - createLead com key reservada em defs falha fast (CustomAttrReservedKeyError).
 *  - updateLead com P2002 em idx_leads_custom_<key>_unique retorna
 *    "Valor duplicado em <label>".
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const leadCreateMock = vi.fn();
const leadUpdateManyMock = vi.fn();
const leadFindFirstMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCompanyMembership: { findFirst: vi.fn() },
    lead: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },
    customAttribute: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(async (cb: any) =>
      cb({
        lead: {
          create: leadCreateMock,
          updateMany: leadUpdateManyMock,
          findFirst: leadFindFirstMock,
        },
      }),
    ),
  },
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: any) => fn,
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map<string, string>()),
}));
vi.mock("@/lib/consent", () => ({
  recordConsent: vi.fn(),
  maskIp: () => "127.0.0.0/24",
}));
vi.mock("@/lib/automation/dispatcher", () => ({
  dispatch: vi.fn(async () => undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Mock do list — retorna defs que os testes controlam via closure.
let currentDefs: any[] = [];
vi.mock("@/lib/custom-attributes/list", () => ({
  listCustomAttributes: vi.fn(async () => currentDefs),
  invalidateCustomAttrsCache: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createLead, updateLead } from "./leads";

const mockUser = {
  id: "user-1",
  email: "u@x.com",
  name: "User",
  platformRole: "admin",
  isSuperAdmin: false,
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  leadCreateMock.mockReset();
  leadUpdateManyMock.mockReset();
  leadFindFirstMock.mockReset();
  currentDefs = [];
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  (
    prisma.userCompanyMembership.findFirst as ReturnType<typeof vi.fn>
  ).mockResolvedValue({ companyId: "company-A" });
});

const baseConsent = { marketing: false, tracking: false };

describe("leads custom attributes integration (T15)", () => {
  it("createLead com custom válido persiste custom:{...}", async () => {
    currentDefs = [
      {
        id: "d1",
        companyId: "company-A",
        entity: "lead",
        key: "priority",
        label: "Priority",
        type: "select",
        required: false,
        unique: false,
        visibleInList: true,
        position: 0,
        status: "active",
        piiMasked: false,
        options: [
          { value: "low", label: "Low" },
          { value: "high", label: "High" },
        ],
        maxLength: null,
      },
    ];
    leadCreateMock.mockResolvedValue({
      id: "lead-1",
      name: "John",
      email: null,
      phone: null,
      company: null,
      source: null,
      status: "new",
      consentMarketing: false,
      consentTracking: false,
    });

    const r = await createLead({
      name: "John",
      consent: baseConsent,
      custom: { priority: "high" },
    } as any);

    expect(r.success).toBe(true);
    expect(leadCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          custom: { priority: "high" },
        }),
      }),
    );
  });

  it("createLead com custom inválido retorna Zod error", async () => {
    currentDefs = [
      {
        id: "d2",
        companyId: "company-A",
        entity: "lead",
        key: "score",
        label: "Score",
        type: "number",
        required: false,
        unique: false,
        visibleInList: false,
        position: 0,
        status: "active",
        piiMasked: false,
        options: null,
        maxLength: null,
      },
    ];

    const r = await createLead({
      name: "John",
      consent: baseConsent,
      custom: { score: "not-a-number" },
    } as any);

    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
    expect(leadCreateMock).not.toHaveBeenCalled();
  });

  it("createLead com payload > 32KB rejeita", async () => {
    currentDefs = [
      {
        id: "d3",
        companyId: "company-A",
        entity: "lead",
        key: "bio",
        label: "Bio",
        type: "text",
        required: false,
        unique: false,
        visibleInList: false,
        position: 0,
        status: "active",
        piiMasked: false,
        options: null,
        maxLength: 100000,
      },
    ];
    const huge = "a".repeat(40 * 1024);

    const r = await createLead({
      name: "John",
      consent: baseConsent,
      custom: { bio: huge },
    } as any);

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/32|byte|exced/i);
    expect(leadCreateMock).not.toHaveBeenCalled();
  });

  it("createLead com key reservada em defs falha fast", async () => {
    currentDefs = [
      {
        id: "d4",
        companyId: "company-A",
        entity: "lead",
        key: "email", // reserved
        label: "Email",
        type: "text",
        required: false,
        unique: false,
        visibleInList: false,
        position: 0,
        status: "active",
        piiMasked: false,
        options: null,
        maxLength: null,
      },
    ];

    const r = await createLead({
      name: "John",
      consent: baseConsent,
      custom: { email: "x@y.com" },
    } as any);

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/reserv/i);
    expect(leadCreateMock).not.toHaveBeenCalled();
  });

  it("updateLead com P2002 retorna 'Valor duplicado em <label>'", async () => {
    currentDefs = [
      {
        id: "d5",
        companyId: "company-A",
        entity: "lead",
        key: "cnpj",
        label: "CNPJ",
        type: "text",
        required: false,
        unique: true,
        visibleInList: true,
        position: 0,
        status: "active",
        piiMasked: false,
        options: null,
        maxLength: null,
      },
    ];

    const p2002 = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: "idx_leads_custom_cnpj_unique" },
    });
    leadUpdateManyMock.mockRejectedValue(p2002);

    const r = await updateLead("lead-1", {
      custom: { cnpj: "123" },
    } as any);

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Valor duplicado em CNPJ/);
  });
});
