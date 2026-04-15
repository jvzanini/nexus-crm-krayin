import { Readable } from "stream";
import { FsStorageAdapter } from "./fs-adapter";

export interface StorageAdapter {
  put(
    key: string,
    data: Buffer | Readable,
    opts?: { contentType?: string },
  ): Promise<void>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  signedUrl(
    key: string,
    opts: { ttlSec: number; download?: boolean; filename?: string },
  ): Promise<string>;
  exists(key: string): Promise<boolean>;
}

/**
 * Factory do adapter de storage. Escolhe entre FS (dev/default) e S3 (prod)
 * via `STORAGE_DRIVER`. S3 é importado lazy para evitar custo de bundle
 * quando não usado.
 */
export function createStorage(): StorageAdapter {
  if (process.env.STORAGE_DRIVER === "s3") {
    // Lazy require para não carregar aws-sdk em dev.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3StorageAdapter } = require("./s3-adapter");
    return new S3StorageAdapter();
  }
  return new FsStorageAdapter({
    root: process.env.STORAGE_FS_ROOT ?? "/tmp/crm-storage",
  });
}

export { FsStorageAdapter };
