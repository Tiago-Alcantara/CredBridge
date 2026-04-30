import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { STORAGE_SERVICE } from './storage.interface';

@Global()
@Module({
  providers: [{ provide: STORAGE_SERVICE, useClass: S3Service }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
