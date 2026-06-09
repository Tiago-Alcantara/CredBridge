import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { FinancialAuthorizationsModule } from '../financial-authorizations/financial-authorizations.module';
import { BlockchainModule } from '../../shared/blockchain/blockchain.module';
import { ReceivablesController } from './receivables.controller';
import { ReceivablesService } from './receivables.service';
import { ReceivablesRepository } from './receivables.repository';
import { PixModule } from '../pix/pix.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    BlockchainModule,
    FinancialAuthorizationsModule,
    PixModule,
  ],
  controllers: [ReceivablesController],
  providers: [ReceivablesService, ReceivablesRepository],
  exports: [ReceivablesService],
})
export class ReceivablesModule {}
