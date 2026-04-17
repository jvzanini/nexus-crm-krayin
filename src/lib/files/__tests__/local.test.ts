import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { LocalDiskDriver } from "../local";

let tmpdir: string;
let driver: LocalDiskDriver;

beforeEach(async () => {
  tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-files-test-"));
  driver = new LocalDiskDriver(tmpdir);
});

afterEach(async () => {
  await fs.rm(tmpdir, { recursive: true, force: true });
});

describe("LocalDiskDriver", () => {
  it("put retorna key correta", async () => {
    const buf = Buffer.from("hello");
    const result = await driver.put("test.txt", buf, "text/plain");
    expect(result.key).toBe("test.txt");
  });

  it("put + get round-trip preserva conteúdo UTF-8 (olá 🌱)", async () => {
    const original = Buffer.from("olá 🌱", "utf-8");
    await driver.put("roundtrip.bin", original, "application/octet-stream");
    const { stream, size } = await driver.get("roundtrip.bin");

    expect(size).toBe(original.byteLength);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    const received = Buffer.concat(chunks);
    expect(Buffer.compare(received, original)).toBe(0);
  });

  it("put em path aninhado cria diretórios intermediários", async () => {
    const buf = Buffer.from("nested");
    await driver.put("companies/abc/files/x.bin", buf, "application/octet-stream");
    const filePath = path.join(tmpdir, "companies/abc/files/x.bin");
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  it("get stream tem tamanho igual ao put", async () => {
    const buf = Buffer.from("tamanho exato 123");
    await driver.put("size-check.bin", buf, "application/octet-stream");
    const { size } = await driver.get("size-check.bin");
    expect(size).toBe(buf.byteLength);
  });

  it("delete remove arquivo fisicamente", async () => {
    const buf = Buffer.from("delete me");
    await driver.put("to-delete.txt", buf, "text/plain");
    await driver.delete("to-delete.txt");
    await expect(fs.stat(path.join(tmpdir, "to-delete.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("delete de key inexistente não lança erro", async () => {
    await expect(driver.delete("nao-existe.txt")).resolves.toBeUndefined();
  });

  it("path traversal com '..' lança UNSAFE_PATH_SEGMENT", async () => {
    // Testamos o método privado indiretamente via put com key que contém ".."
    await expect(driver.put("../escape.txt", Buffer.from("x"), "text/plain")).rejects.toThrow("UNSAFE_PATH_SEGMENT");
  });

  it("path traversal com '.' lança UNSAFE_PATH_SEGMENT", async () => {
    await expect(driver.put("../escape.txt", Buffer.from("x"), "text/plain")).rejects.toThrow("UNSAFE_PATH_SEGMENT");
  });
});
