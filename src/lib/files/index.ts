import type { FileStorageDriver } from "./driver";
import { LocalDiskDriver } from "./local";

let cached: FileStorageDriver | null = null;

export function getFileDriver(): FileStorageDriver {
  if (cached) return cached;
  const driverKey = process.env.FILE_STORAGE_DRIVER ?? "local";
  switch (driverKey) {
    case "local":
      cached = new LocalDiskDriver();
      return cached;
    default:
      throw new Error(`UNKNOWN_FILE_STORAGE_DRIVER:${driverKey}`);
  }
}

export type { FileStorageDriver, FileGetResult, FilePutResult } from "./driver";
export { LocalDiskDriver } from "./local";
export {
  ALLOWED_MIMES,
  isAllowedMime,
  enforceMime,
  enforceSize,
  DEFAULT_MAX_SIZE_MB,
  FileTooLargeError,
  DisallowedMimeError,
} from "./allowlist";
