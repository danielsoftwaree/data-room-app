/**
 * Abstraction over where file bytes live. The database stores only metadata;
 * blob content goes through this interface so the driver can be swapped via
 * env (STORAGE_DRIVER): "db" for zero-setup local dev, "s3" for production
 * (any S3-compatible bucket, e.g. Railway).
 */
export interface StoredBlob {
  content: Buffer;
  contentType: string;
}

export interface PutBlobInput {
  key: string;
  content: Buffer;
  contentType: string;
}

export interface BlobStorage {
  put(input: PutBlobInput): Promise<void>;
  get(key: string): Promise<StoredBlob | undefined>;
  /** Best-effort cleanup after the owning nodes were removed from the database. */
  deleteMany(keys: string[]): Promise<void>;
}

export const BLOB_STORAGE = Symbol('BLOB_STORAGE');
