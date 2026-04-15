import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import type { StorageAdapter } from "./index";

/**
 * S3StorageAdapter — AWS S3 / MinIO via aws-sdk v3.
 *
 * Lê env vars em runtime (não no construtor do módulo) para facilitar
 * testes. `deletePrefix` pagina `ListObjectsV2` (1000/page) e envia
 * `DeleteObjects` em batches de 1000.
 */
export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.S3_REGION ?? "us-east-1";
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET ausente");
    this.bucket = bucket;
    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  async put(
    key: string,
    data: Buffer | Readable,
    opts?: { contentType?: string },
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data as any,
        ContentType: opts?.contentType,
      }),
    );
  }

  async get(key: string): Promise<Readable> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const body = out.Body;
    if (!body) throw new Error(`S3 get: sem body para ${key}`);
    // v3 retorna SdkStream — tem transformToWebStream() em Node.
    if (typeof (body as { transformToWebStream?: () => ReadableStream })
      .transformToWebStream === "function") {
      const web = (body as unknown as { transformToWebStream: () => ReadableStream })
        .transformToWebStream();
      return Readable.fromWeb(web as any);
    }
    // Fallback: já é Readable.
    return body as unknown as Readable;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async deletePrefix(prefix: string): Promise<void> {
    let token: string | undefined = undefined;
    do {
      const list = (await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
      )) as unknown as {
        Contents?: { Key?: string }[];
        IsTruncated?: boolean;
        NextContinuationToken?: string;
      };
      const contents = list.Contents ?? [];
      if (contents.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: contents
                .filter((o) => o.Key)
                .map((o) => ({ Key: o.Key! })),
              Quiet: true,
            },
          }),
        );
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
  }

  async signedUrl(
    key: string,
    opts: { ttlSec: number; download?: boolean; filename?: string },
  ): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition:
        opts.download && opts.filename
          ? `attachment; filename="${opts.filename.replace(/"/g, "")}"`
          : opts.download
            ? "attachment"
            : undefined,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: opts.ttlSec });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (err: unknown) {
      const name = (err as { name?: string }).name;
      if (name === "NotFound" || name === "NoSuchKey") return false;
      throw err;
    }
  }
}
