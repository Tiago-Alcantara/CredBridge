import { Global, Module } from '@nestjs/common';
import { KycProviderService } from './kyc.service';
import { KYC_SERVICE } from './kyc.interface';

@Global()
@Module({
  providers: [{ provide: KYC_SERVICE, useClass: KycProviderService }],
  exports: [KYC_SERVICE],
})
export class KycModule {}
