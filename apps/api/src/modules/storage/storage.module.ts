import { Module } from '@nestjs/common';
import type { Database } from '@repo/db';
import { DRIZZLE } from '../../config/database/database.tokens';
import { EnvService } from '../../config/env';
import { BLOB_STORAGE } from './blob-storage';
import type { BlobStorage } from './blob-storage';
import { DbBlobStorage } from './db-blob-storage';
import { S3BlobStorage } from './s3-blob-storage';

@Module({
  providers: [
    {
      provide: BLOB_STORAGE,
      inject: [DRIZZLE, EnvService],
      useFactory: (db: Database, env: EnvService): BlobStorage =>
        env.get('STORAGE_DRIVER') === 's3' ? createS3BlobStorage(env) : new DbBlobStorage(db),
    },
  ],
  exports: [BLOB_STORAGE],
})
export class StorageModule {}

function createS3BlobStorage(env: EnvService): S3BlobStorage {
  const bucket = env.get('S3_BUCKET');
  const accessKeyId = env.get('S3_ACCESS_KEY_ID');
  const secretAccessKey = env.get('S3_SECRET_ACCESS_KEY');

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 storage is missing required configuration');
  }

  return new S3BlobStorage({
    endpoint: env.get('S3_ENDPOINT'),
    region: env.get('S3_REGION'),
    bucket,
    accessKeyId,
    secretAccessKey,
  });
}
