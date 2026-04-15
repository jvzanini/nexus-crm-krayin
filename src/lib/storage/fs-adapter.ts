import { promises as fs, createReadStream, createWriteStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { StorageAdapter } from "./index";
import { buildSignedPath } from "./sign";

interface FsOpts {
  root: string;
}

/**
 * FsStorageAdapter — grava arquivos em disco local.
 *
 * Segurança:
 * - `path.resolve(root, key)` + verificação `startsWith(root)` previne path traversal.
 * - `mode: 0o600` em arquivos criados.
 */
export class FsStorageAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(opts: FsOpts) {
    this.root = path.resolve(opts.root);
  }

  private resolveSafe(key: string): string {
    if (!key || key.startsWith("/") || key.includes("\0")) {
      throw new Error(`invalid key: ${key}`);
    }
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root + path.sep) && resolved !== this.root) {
      throw new Error(`invalid key (path traversal): ${key}`);
    }
    return resolved;
  }

  async put(key: string, data: Buffer | Readable): Promise<void> {
    const full = this.resolveSafe(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(data)) {
      await fs.writeFile(full, data, { mode: 0o600 });
      return;
    }
    const ws = createWriteStream(full, { mode: 0o600 });
    await pipeline(data, ws);
  }

  async get(key: string): Promise<Readable> {
    const full = this.resolveSafe(key);
    // Garante que existe antes de retornar o stream.
    await fs.access(full);
    return createReadStream(full);
  }

  async delete(key: string): Promise<void> {
    const full = this.resolveSafe(key);
    try {
      await fs.unlink(full);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    // Normaliza (aceita com/sem trailing slash).
    const trimmed = prefix.replace(/\/+$/, "");
    const full = this.resolveSafe(trimmed);
    try {
      await fs.rm(full, { recursive: true, force: true });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async signedUrl(
    key: string,
    opts: { ttlSec: number; download?: boolean; filename?: string },
  ): Promise<string> {
    // Garante que o key é válido (path traversal check).
    this.resolveSafe(key);
    const basePath = buildSignedPath(key, opts.ttlSec);
    const url = new URL(basePath, "http://placeholder");
    if (opts.download) url.searchParams.set("download", "1");
    if (opts.filename) url.searchParams.set("filename", opts.filename);
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  async exists(key: string): Promise<boolean> {
    const full = this.resolveSafe(key);
    try {
      await fs.access(full);
      return true;
    } catch {
      return false;
    }
  }
}
