import { Global, Module } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { BLOCKCHAIN_SERVICE } from './blockchain.interface';

@Global()
@Module({
  providers: [
    StellarService,
    { provide: BLOCKCHAIN_SERVICE, useClass: StellarService },
  ],
  exports: [StellarService, BLOCKCHAIN_SERVICE],
})
export class BlockchainModule {}
