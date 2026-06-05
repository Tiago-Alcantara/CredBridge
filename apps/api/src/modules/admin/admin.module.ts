import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BlockchainModule } from '../../shared/blockchain/blockchain.module';
import { AuthModule } from '../auth/auth.module';
import { ReceivablesModule } from '../receivables/receivables.module';

@Module({
  imports: [BlockchainModule, AuthModule, ReceivablesModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
