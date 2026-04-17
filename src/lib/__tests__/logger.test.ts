import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";
import { maskEmail, redactCustomPii } from "../logger";

function makeCapturingLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });

  const log = pino(
    {
      level: "debug",
      redact: {
        paths: ["password", "token", "req.headers.authorization"],
        censor: "[REDACTED]",
      },
    },
    stream,
  );

  return { log, lines };
}

describe("logger redactors", () => {
  it("redige password", () => {
    const { log, lines } = makeCapturingLogger();
    log.info({ password: "s3cret", user: "a" }, "msg");
    const parsed = JSON.parse(lines[0]);
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.user).toBe("a");
  });

  it("redige token e authorization header", () => {
    const { log, lines } = makeCapturingLogger();
    log.info(
      {
        token: "abc",
        req: { headers: { authorization: "Bearer xxx", other: "keep" } },
      },
      "req",
    );
    const parsed = JSON.parse(lines[0]);
    expect(parsed.token).toBe("[REDACTED]");
    expect(parsed.req.headers.authorization).toBe("[REDACTED]");
    expect(parsed.req.headers.other).toBe("keep");
  });
});

describe("maskEmail", () => {
  it("mascara local part preservando domínio", () => {
    expect(maskEmail("joao@example.com")).toBe("j***@example.com");
    expect(maskEmail("a@b.co")).toBe("a**@b.co");
  });
  it("retorna null para entrada inválida", () => {
    expect(maskEmail("")).toBeNull();
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail(undefined)).toBeNull();
    expect(maskEmail("nope")).toBeNull();
    expect(maskEmail("@nope.com")).toBeNull();
  });
});

describe("redactCustomPii", () => {
  it("gera paths para keys piiMasked=true em custom.* e req.body.custom.*", () => {
    const defs = [
      { key: "cpf", piiMasked: true },
      { key: "mrr", piiMasked: false },
      { key: "passport", piiMasked: true },
    ];
    const result = redactCustomPii(defs as any);
    expect(result.paths).toEqual(
      expect.arrayContaining([
        "custom.cpf",
        "custom.passport",
        "req.body.custom.cpf",
        "req.body.custom.passport",
      ]),
    );
    expect(result.paths).not.toContain("custom.mrr");
  });

  it("defs vazio ou sem piiMasked retorna paths=[]", () => {
    expect(redactCustomPii([] as any).paths).toEqual([]);
    expect(redactCustomPii([{ key: "mrr", piiMasked: false }] as any).paths).toEqual([]);
  });
});
