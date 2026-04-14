import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import type { FileStorageDriver, FileGetResult, FilePutResult } from "./driver";

export class LocalDiskDriver implements FileStorageDriver {
  constructor(private readonly root: string = process.env.FILE_STORAGE_ROOT ?? "./.storage/files") {}

  private full(key: string): string {
    const safe = key.split("/").filter(Boolean).map((seg) => {
      if (seg === "." || seg === "..") throw new Error(`UNSAFE_PATH_SEGMENT:${seg}`);
      return seg;
    }).join("/");
    return path.join(this.root, safe);
  }

  async put(key: string, bytes: Buffer, mime: string): Promise<FilePutResult> {
    const full = this.full(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    // mime é persistido em DB (ActivityFile.mimeType); driver não armazena metadata.
    return { key };
  }

  async get(key: string): Promise<FileGetResult> {
    const full = this.full(key);
    const stat = await fs.stat(full);
    const stream = createReadStream(full);
    return { stream, size: stat.size, mime: "application/octet-stream" };
  }

  async delete(key: string): Promise<void> {
    const full = this.full(key);
    try {
      await fs.unlink(full);
    } catch (err: any) {
      if (err?.code !== "ENOENT") throw err;
    }
  }
}
