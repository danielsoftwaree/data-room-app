import { Module } from '@nestjs/common';
import type { Database } from '@repo/db';
import { DRIZZLE } from '../../config/database/database.tokens';
import { getS3Config, getStorageDriver } from '../../config/env/env';
import { BLOB_STORAGE } from './blob-storage';
import type { BlobStorage } from './blob-storage';
import { DbBlobStorage } from './db-blob-storage';
import { S3BlobStorage } from './s3-blob-storage';

@Module({
  providers: [
    {
      provide: BLOB_STORAGE,
      inject: [DRIZZLE],
      useFactory: (db: Database): BlobStorage =>
        getStorageDriver() === 's3' ? new S3BlobStorage(getS3Config()) : new DbBlobStorage(db),
    },
  ],
  exports: [BLOB_STORAGE],
})
export class StorageModule {}
