import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { S3Config } from '../../config/env/env';
import type { BlobStorage, PutBlobInput, StoredBlob } from './blob-storage';

const DELETE_BATCH_SIZE = 1000;

/** S3-compatible blob storage (AWS S3, Railway bucket, R2, MinIO, ...). */
export class S3BlobStorage implements BlobStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      // Custom endpoints (Railway/MinIO/R2) usually require path-style addressing.
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(input: PutBlobInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.content,
        ContentType: input.contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredBlob | undefined> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) return undefined;
      return {
        content: Buffer.from(bytes),
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (let offset = 0; offset < keys.length; offset += DELETE_BATCH_SIZE) {
      const chunk = keys.slice(offset, offset + DELETE_BATCH_SIZE);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('name' in error)) return false;
  const name = (error as { name?: unknown }).name;
  return name === 'NoSuchKey' || name === 'NotFound';
}
