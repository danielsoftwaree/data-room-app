import { fileBlobs } from '@repo/db';
import { eq } from '@repo/db';
import type { Database } from '@repo/db';
import type { BlobStorage, PutBlobInput, StoredBlob } from './blob-storage';

/**
 * Stores blobs in the file_blobs table (bytea). Zero-setup default for local
 * development; production should use S3BlobStorage.
 */
export class DbBlobStorage implements BlobStorage {
  constructor(private readonly db: Database) {}

  async put(input: PutBlobInput): Promise<void> {
    await this.db.insert(fileBlobs).values({
      nodeId: input.key,
      content: input.content,
      contentType: input.contentType,
    });
  }

  async get(key: string): Promise<StoredBlob | undefined> {
    const [row] = await this.db
      .select({ content: fileBlobs.content, contentType: fileBlobs.contentType })
      .from(fileBlobs)
      .where(eq(fileBlobs.nodeId, key))
      .limit(1);
    return row ? { content: row.content, contentType: row.contentType } : undefined;
  }

  async deleteMany(): Promise<void> {
    // Rows are removed by the ON DELETE CASCADE foreign key when nodes are deleted.
  }
}
