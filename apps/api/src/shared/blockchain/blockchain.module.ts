import { Global, Module } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { BLOCKCHAIN_SERVICE } from './blockchain.interface';

@Global()
@Module({
  providers: [{ provide: BLOCKCHAIN_SERVICE, useClass: StellarService }],
  exports: [BLOCKCHAIN_SERVICE],
})
export class BlockchainModule {}
