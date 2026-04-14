/**
 * Testes de validação pura (Zod) das server actions de activities.
 * Não testa integração DB/queue.
 */

import { describe, it, expect } from "vitest";
import { _schemas } from "./activities-schemas";

const { createActivity: schema } = _schemas;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function futureDate(offsetMs = 60_000): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function pastDate(offsetMs = 60_000): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

// UUID v4 válido para testes
const VALID_UUID = "123e4567-e89b-42d3-a456-426614174000";

const validBase = {
  type: "task",
  subjectType: "lead",
  subjectId: VALID_UUID,
  title: "Ligar para o lead",
} as const;

function firstIssueMessage(result: ReturnType<typeof schema.safeParse>): string {
  if (result.success) return "";
  return result.error.issues.map((i) => i.message).join(", ");
}

// ---------------------------------------------------------------------------
// title
// ---------------------------------------------------------------------------

describe("createActivity schema — title", () => {
  it("rejeita title vazio", () => {
    const r = schema.safeParse({ ...validBase, title: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssueMessage(r)).toMatch(/obrigatório/i);
    }
  });

  it("rejeita title com mais de 200 caracteres", () => {
    const r = schema.safeParse({ ...validBase, title: "a".repeat(201) });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssueMessage(r)).toMatch(/200/i);
    }
  });

  it("aceita title válido", () => {
    const r = schema.safeParse({ ...validBase, title: "Reunião de kickoff" });
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// type
// ---------------------------------------------------------------------------

describe("createActivity schema — type", () => {
  it("rejeita type fora do enum", () => {
    const r = schema.safeParse({ ...validBase, type: "email" });
    expect(r.success).toBe(false);
  });

  it("aceita todos os types válidos", () => {
    const types = ["call", "meeting", "task", "note", "file"];
    for (const type of types) {
      const r = schema.safeParse({ ...validBase, type });
      expect(r.success, `type "${type}" deveria ser válido`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// subjectType
// ---------------------------------------------------------------------------

describe("createActivity schema — subjectType", () => {
  it("rejeita subjectType fora do enum", () => {
    const r = schema.safeParse({ ...validBase, subjectType: "account" });
    expect(r.success).toBe(false);
  });

  it("aceita todos os subjectTypes válidos", () => {
    const types = ["lead", "contact", "opportunity"];
    for (const subjectType of types) {
      const r = schema.safeParse({ ...validBase, subjectType });
      expect(r.success, `subjectType "${subjectType}" deveria ser válido`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// subjectId
// ---------------------------------------------------------------------------

describe("createActivity schema — subjectId", () => {
  it("rejeita subjectId que não é UUID", () => {
    const r = schema.safeParse({ ...validBase, subjectId: "nao-eh-uuid" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssueMessage(r)).toMatch(/uuid/i);
    }
  });

  it("aceita subjectId UUID válido", () => {
    const r = schema.safeParse({ ...validBase, subjectId: VALID_UUID });
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// timezone
// ---------------------------------------------------------------------------

describe("createActivity schema — timezone", () => {
  const hasIntlSupport =
    typeof (Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf === "function";

  it("aceita ausência de timezone", () => {
    const r = schema.safeParse({ ...validBase });
    expect(r.success).toBe(true);
  });

  it("aceita timezone IANA válida — America/Sao_Paulo", () => {
    const r = schema.safeParse({ ...validBase, timezone: "America/Sao_Paulo" });
    expect(r.success).toBe(true);
  });

  it("aceita timezone IANA válida — America/New_York", () => {
    const r = schema.safeParse({ ...validBase, timezone: "America/New_York" });
    expect(r.success).toBe(true);
  });

  it.runIf(hasIntlSupport)(
    "rejeita timezone IANA inválida quando Intl.supportedValuesOf disponível",
    () => {
      const r = schema.safeParse({ ...validBase, timezone: "Planeta/Marte" });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(firstIssueMessage(r)).toMatch(/timezone/i);
      }
    }
  );
});

// ---------------------------------------------------------------------------
// reminderAt
// ---------------------------------------------------------------------------

describe("createActivity schema — reminderAt", () => {
  it("rejeita reminderAt no passado", () => {
    const r = schema.safeParse({ ...validBase, reminderAt: pastDate() });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssueMessage(r)).toMatch(/futuro/i);
    }
  });

  it("aceita reminderAt no futuro", () => {
    const r = schema.safeParse({ ...validBase, reminderAt: futureDate() });
    expect(r.success).toBe(true);
  });

  it("aceita ausência de reminderAt", () => {
    const r = schema.safeParse({ ...validBase });
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// durationMin
// ---------------------------------------------------------------------------

describe("createActivity schema — durationMin", () => {
  it("rejeita durationMin negativo", () => {
    const r = schema.safeParse({ ...validBase, durationMin: -1 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssueMessage(r)).toMatch(/negativ/i);
    }
  });

  it("rejeita durationMin > 1440", () => {
    const r = schema.safeParse({ ...validBase, durationMin: 1441 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssueMessage(r)).toMatch(/1440|24/i);
    }
  });

  it("aceita durationMin = 0", () => {
    const r = schema.safeParse({ ...validBase, durationMin: 0 });
    expect(r.success).toBe(true);
  });

  it("aceita durationMin = 1440", () => {
    const r = schema.safeParse({ ...validBase, durationMin: 1440 });
    expect(r.success).toBe(true);
  });

  it("aceita durationMin = 90", () => {
    const r = schema.safeParse({ ...validBase, durationMin: 90 });
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// description
// ---------------------------------------------------------------------------

describe("createActivity schema — description", () => {
  it("rejeita description com mais de 5000 caracteres", () => {
    const r = schema.safeParse({ ...validBase, description: "x".repeat(5001) });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssueMessage(r)).toMatch(/5000/i);
    }
  });

  it("aceita description válida", () => {
    const r = schema.safeParse({ ...validBase, description: "Uma descrição qualquer." });
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// location
// ---------------------------------------------------------------------------

describe("createActivity schema — location", () => {
  it("rejeita location com mais de 500 caracteres", () => {
    const r = schema.safeParse({ ...validBase, location: "x".repeat(501) });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssueMessage(r)).toMatch(/500/i);
    }
  });

  it("aceita location válida", () => {
    const r = schema.safeParse({ ...validBase, location: "https://meet.example.com/xyz" });
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// assignedTo
// ---------------------------------------------------------------------------

describe("createActivity schema — assignedTo", () => {
  it("rejeita assignedTo que não é UUID", () => {
    const r = schema.safeParse({ ...validBase, assignedTo: "usuario-invalido" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssueMessage(r)).toMatch(/uuid/i);
    }
  });

  it("aceita assignedTo UUID válido", () => {
    const r = schema.safeParse({ ...validBase, assignedTo: VALID_UUID });
    expect(r.success).toBe(true);
  });

  it("aceita ausência de assignedTo", () => {
    const r = schema.safeParse({ ...validBase });
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateActivity schema
// ---------------------------------------------------------------------------

describe("updateActivity schema", () => {
  const { updateActivity: updateSchema } = _schemas;

  it("aceita patch vazio", () => {
    const r = updateSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("rejeita title vazio em patch", () => {
    const r = updateSchema.safeParse({ title: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message).join(", ")).toMatch(/obrigatório/i);
    }
  });

  it("rejeita durationMin > 1440 em patch", () => {
    const r = updateSchema.safeParse({ durationMin: 2000 });
    expect(r.success).toBe(false);
  });

  it("rejeita reminderAt no passado em patch", () => {
    const r = updateSchema.safeParse({ reminderAt: pastDate() });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message).join(", ")).toMatch(/futuro/i);
    }
  });

  it("aceita reminderAt null (remover reminder)", () => {
    const r = updateSchema.safeParse({ reminderAt: null });
    expect(r.success).toBe(true);
  });

  it("aceita reminderAt no futuro em patch", () => {
    const r = updateSchema.safeParse({ reminderAt: futureDate() });
    expect(r.success).toBe(true);
  });
});
