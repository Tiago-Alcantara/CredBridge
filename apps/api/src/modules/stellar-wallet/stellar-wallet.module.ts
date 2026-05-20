import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { StellarWalletController } from './stellar-wallet.controller';
import { StellarWalletService } from './stellar-wallet.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [StellarWalletController],
  providers: [StellarWalletService],
})
export class StellarWalletModule {}
