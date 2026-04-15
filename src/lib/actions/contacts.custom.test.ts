/**
 * Fase 5 — T16/34: integração custom attributes em contacts actions.
 *
 * Cobre:
 *  - createContact com custom válido persiste `custom:{...}` no Prisma.create.
 *  - createContact com custom inválido (tipo errado) retorna erro de validação.
 *  - createContact com payload > 32KB rejeita com CustomAttrBytesExceededError.
 *  - createContact com key reservada em defs falha fast (CustomAttrReservedKeyError).
 *  - updateContact com P2002 em idx_contacts_custom_<key>_unique retorna
 *    "Valor duplicado em <label>".
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const contactCreateMock = vi.fn();
const contactUpdateManyMock = vi.fn();
const contactFindFirstMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCompanyMembership: { findFirst: vi.fn() },
    contact: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },
    customAttribute: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(async (cb: any) =>
      cb({
        contact: {
          create: contactCreateMock,
          updateMany: contactUpdateManyMock,
          findFirst: contactFindFirstMock,
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
import { createContact, updateContact } from "./contacts";

const mockUser = {
  id: "user-1",
  email: "u@x.com",
  name: "User",
  platformRole: "admin",
  isSuperAdmin: false,
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  contactCreateMock.mockReset();
  contactUpdateManyMock.mockReset();
  contactFindFirstMock.mockReset();
  currentDefs = [];
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  (
    prisma.userCompanyMembership.findFirst as ReturnType<typeof vi.fn>
  ).mockResolvedValue({ companyId: "company-A" });
});

const baseConsent = { marketing: false, tracking: false };

describe("contacts custom attributes integration (T16)", () => {
  it("createContact com custom válido persiste custom:{...}", async () => {
    currentDefs = [
      {
        id: "d1",
        companyId: "company-A",
        entity: "contact",
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
    contactCreateMock.mockResolvedValue({
      id: "contact-1",
      firstName: "John",
      lastName: "Doe",
      email: null,
      phone: null,
      organization: null,
      title: null,
      consentMarketing: false,
      consentTracking: false,
    });

    const r = await createContact({
      firstName: "John",
      lastName: "Doe",
      consent: baseConsent,
      custom: { priority: "high" },
    } as any);

    expect(r.success).toBe(true);
    expect(contactCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          custom: { priority: "high" },
        }),
      }),
    );
  });

  it("createContact com custom inválido retorna Zod error", async () => {
    currentDefs = [
      {
        id: "d2",
        companyId: "company-A",
        entity: "contact",
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

    const r = await createContact({
      firstName: "John",
      lastName: "Doe",
      consent: baseConsent,
      custom: { score: "not-a-number" },
    } as any);

    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
    expect(contactCreateMock).not.toHaveBeenCalled();
  });

  it("createContact com payload > 32KB rejeita", async () => {
    currentDefs = [
      {
        id: "d3",
        companyId: "company-A",
        entity: "contact",
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

    const r = await createContact({
      firstName: "John",
      lastName: "Doe",
      consent: baseConsent,
      custom: { bio: huge },
    } as any);

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/32|byte|exced/i);
    expect(contactCreateMock).not.toHaveBeenCalled();
  });

  it("createContact com key reservada em defs falha fast", async () => {
    currentDefs = [
      {
        id: "d4",
        companyId: "company-A",
        entity: "contact",
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

    const r = await createContact({
      firstName: "John",
      lastName: "Doe",
      consent: baseConsent,
      custom: { email: "x@y.com" },
    } as any);

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/reserv/i);
    expect(contactCreateMock).not.toHaveBeenCalled();
  });

  it("updateContact com P2002 retorna 'Valor duplicado em <label>'", async () => {
    currentDefs = [
      {
        id: "d5",
        companyId: "company-A",
        entity: "contact",
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
      meta: { target: "idx_contacts_custom_cnpj_unique" },
    });
    contactUpdateManyMock.mockRejectedValue(p2002);

    const r = await updateContact("contact-1", {
      custom: { cnpj: "123" },
    } as any);

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Valor duplicado em CNPJ/);
  });
});
