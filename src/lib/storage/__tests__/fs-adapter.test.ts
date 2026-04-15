import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { Readable } from "stream";
import { FsStorageAdapter } from "../fs-adapter";
import { verifySignedUrlParams } from "../sign";

async function streamToString(r: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of r) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks).toString("utf-8");
}

describe("FsStorageAdapter", () => {
  let root: string;
  let adapter: FsStorageAdapter;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "fs-adapter-"));
    adapter = new FsStorageAdapter({ root });
    process.env.STORAGE_SIGN_SECRET = "test-secret-for-hmac-validation-only";
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("put + get round-trip para Buffer", async () => {
    await adapter.put("exports/co1/job1/file.csv", Buffer.from("a,b\n1,2"));
    const stream = await adapter.get("exports/co1/job1/file.csv");
    expect(await streamToString(stream)).toBe("a,b\n1,2");
  });

  it("delete remove arquivo individual", async () => {
    await adapter.put("quarantine/co1/j1/original.csv", Buffer.from("x"));
    await adapter.delete("quarantine/co1/j1/original.csv");
    expect(await adapter.exists("quarantine/co1/j1/original.csv")).toBe(false);
  });

  it("deletePrefix apaga todos os filhos", async () => {
    await adapter.put("quarantine/co1/jA/a.csv", Buffer.from("x"));
    await adapter.put("quarantine/co1/jA/b.csv", Buffer.from("y"));
    await adapter.put("quarantine/co1/jB/c.csv", Buffer.from("z"));
    await adapter.deletePrefix("quarantine/co1/jA/");
    expect(await adapter.exists("quarantine/co1/jA/a.csv")).toBe(false);
    expect(await adapter.exists("quarantine/co1/jA/b.csv")).toBe(false);
    expect(await adapter.exists("quarantine/co1/jB/c.csv")).toBe(true);
  });

  it("signedUrl válida passa no verify", async () => {
    await adapter.put("exports/co1/job1/out.csv", Buffer.from("hello"));
    const url = await adapter.signedUrl("exports/co1/job1/out.csv", {
      ttlSec: 60,
    });
    const u = new URL(url, "http://localhost");
    const ok = verifySignedUrlParams({
      key: u.searchParams.get("key")!,
      sig: u.searchParams.get("sig")!,
      exp: u.searchParams.get("exp")!,
    });
    expect(ok.valid).toBe(true);
    expect(ok.key).toBe("exports/co1/job1/out.csv");
  });

  it("signedUrl expirada é rejeitada", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T10:00:00Z"));
    await adapter.put("exports/co1/job1/out.csv", Buffer.from("hello"));
    const url = await adapter.signedUrl("exports/co1/job1/out.csv", {
      ttlSec: 60,
    });
    const u = new URL(url, "http://localhost");
    vi.setSystemTime(new Date("2026-04-15T10:02:00Z")); // +2min > 60s
    const ok = verifySignedUrlParams({
      key: u.searchParams.get("key")!,
      sig: u.searchParams.get("sig")!,
      exp: u.searchParams.get("exp")!,
    });
    expect(ok.valid).toBe(false);
    expect(ok.reason).toBe("expired");
    vi.useRealTimers();
  });

  it("rejeita path traversal", async () => {
    await expect(
      adapter.put("../../../etc/passwd", Buffer.from("oops")),
    ).rejects.toThrow(/invalid key/i);
  });
});
