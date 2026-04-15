import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

// `getSignedUrl` import-time-resolves inside s3-adapter; mock it.
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://signed.example/presigned-url"),
}));

const s3Mock = mockClient(S3Client);

describe("S3StorageAdapter", () => {
  beforeEach(() => {
    s3Mock.reset();
    process.env.S3_BUCKET = "test-bucket";
    process.env.S3_REGION = "us-east-1";
    process.env.S3_ACCESS_KEY_ID = "x";
    process.env.S3_SECRET_ACCESS_KEY = "y";
  });

  afterEach(() => {
    s3Mock.restore();
  });

  it("put envia PutObjectCommand com bucket+key+body", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const { S3StorageAdapter } = await import("../s3-adapter");
    const adapter = new S3StorageAdapter();
    await adapter.put(
      "exports/co/job/file.csv",
      Buffer.from("hello"),
      { contentType: "text/csv" },
    );
    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args[0].input).toMatchObject({
      Bucket: "test-bucket",
      Key: "exports/co/job/file.csv",
      ContentType: "text/csv",
    });
  });

  it("signedUrl retorna URL pre-assinada via getSignedUrl", async () => {
    const { S3StorageAdapter } = await import("../s3-adapter");
    const adapter = new S3StorageAdapter();
    const url = await adapter.signedUrl("exports/co/job/out.xlsx", {
      ttlSec: 3600,
    });
    expect(url).toBe("https://signed.example/presigned-url");
  });

  it("deletePrefix pagina ListObjectsV2 + DeleteObjects em batch", async () => {
    // Primeira page: 1000 objetos + NextContinuationToken.
    const page1Contents = Array.from({ length: 1000 }, (_, i) => ({
      Key: `quarantine/co/job/file-${i}.csv`,
    }));
    const page2Contents = [
      { Key: "quarantine/co/job/file-1000.csv" },
      { Key: "quarantine/co/job/file-1001.csv" },
    ];
    s3Mock
      .on(ListObjectsV2Command)
      .resolvesOnce({
        Contents: page1Contents,
        IsTruncated: true,
        NextContinuationToken: "tok2",
      })
      .resolvesOnce({
        Contents: page2Contents,
        IsTruncated: false,
      });
    s3Mock.on(DeleteObjectsCommand).resolves({ Deleted: [] });

    const { S3StorageAdapter } = await import("../s3-adapter");
    const adapter = new S3StorageAdapter();
    await adapter.deletePrefix("quarantine/co/job/");

    const listCalls = s3Mock.commandCalls(ListObjectsV2Command);
    expect(listCalls).toHaveLength(2);
    const deleteCalls = s3Mock.commandCalls(DeleteObjectsCommand);
    expect(deleteCalls).toHaveLength(2);
    expect(deleteCalls[0]!.args[0].input.Delete?.Objects).toHaveLength(1000);
    expect(deleteCalls[1]!.args[0].input.Delete?.Objects).toHaveLength(2);
  });
});
