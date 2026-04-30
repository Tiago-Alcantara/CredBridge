import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from './storage.interface';

@Injectable()
export class S3Service implements StorageService {
  private readonly logger = new Logger(S3Service.name);

  async upload(key: string, file: Buffer, contentType: string): Promise<string> {
    this.logger.log(`upload called for key: ${key}`);
    // TODO: implement AWS S3 SDK integration
    return `https://s3.example.com/${key}`;
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    this.logger.log(`getSignedUrl called for key: ${key}`);
    // TODO: implement AWS S3 SDK integration
    return `https://s3.example.com/${key}?signed=true&expires=${expiresInSeconds}`;
  }

  async delete(key: string): Promise<void> {
    this.logger.log(`delete called for key: ${key}`);
    // TODO: implement AWS S3 SDK integration
  }
}
