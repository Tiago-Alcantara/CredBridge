import { Global, Module } from '@nestjs/common';
import { PixService } from './pix.service';
import { PAYMENTS_SERVICE } from './payments.interface';

@Global()
@Module({
  providers: [{ provide: PAYMENTS_SERVICE, useClass: PixService }],
  exports: [PAYMENTS_SERVICE],
})
export class PaymentsModule {}
