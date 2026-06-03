import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './shared/prisma/prisma.module';
import { BlockchainModule } from './shared/blockchain/blockchain.module';
import { StorageModule } from './shared/storage/storage.module';
import { KycModule } from './shared/kyc/kyc.module';
import { PaymentsModule } from './shared/payments/payments.module';
import { ReceivablesModule } from './modules/receivables/receivables.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { AuditModule } from './modules/audit/audit.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { StellarWalletModule } from './modules/stellar-wallet/stellar-wallet.module';
import { AnchorModule } from './modules/anchor/anchor.module';
import { FinancialAuthorizationsModule } from './modules/financial-authorizations/financial-authorizations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    BlockchainModule,
    StorageModule,
    KycModule,
    PaymentsModule,
    ReceivablesModule,
    DocumentsModule,
    SettlementsModule,
    AuditModule,
    InvestmentsModule,
    AuthModule,
    HealthModule,
    StellarWalletModule,
    AnchorModule,
    FinancialAuthorizationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
