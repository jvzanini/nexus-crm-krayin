export const ALLOWED_MIMES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain",
  "audio/mpeg", "audio/wav", "audio/ogg",
]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIMES.has(mime);
}

export const DEFAULT_MAX_SIZE_MB = 25;

export class FileTooLargeError extends Error {
  constructor(public readonly bytes: number, public readonly maxMb = DEFAULT_MAX_SIZE_MB) {
    super(`FILE_TOO_LARGE:${bytes}:max=${maxMb}MB`);
    this.name = "FileTooLargeError";
  }
}
export class DisallowedMimeError extends Error {
  constructor(public readonly mime: string) {
    super(`DISALLOWED_MIME:${mime}`);
    this.name = "DisallowedMimeError";
  }
}

export function enforceSize(bytes: number, maxMb = DEFAULT_MAX_SIZE_MB): void {
  if (bytes > maxMb * 1024 * 1024) throw new FileTooLargeError(bytes, maxMb);
}

export function enforceMime(mime: string): void {
  if (!isAllowedMime(mime)) throw new DisallowedMimeError(mime);
}
