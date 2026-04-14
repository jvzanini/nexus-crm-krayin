export interface FilePutResult { key: string }
export interface FileGetResult {
  stream: NodeJS.ReadableStream;
  size: number;
  mime: string;
}
export interface FileStorageDriver {
  put(key: string, bytes: Buffer, mime: string): Promise<FilePutResult>;
  get(key: string): Promise<FileGetResult>;
  delete(key: string): Promise<void>;
}
