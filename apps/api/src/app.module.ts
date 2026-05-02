import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/prisma/prisma.module';
import { BlockchainModule } from './shared/blockchain/blockchain.module';
import { StorageModule } from './shared/storage/storage.module';
import { KycModule } from './shared/kyc/kyc.module';
import { PaymentsModule } from './shared/payments/payments.module';
import { ReceivablesModule } from './modules/receivables/receivables.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BlockchainModule,
    StorageModule,
    KycModule,
    PaymentsModule,
    ReceivablesModule,
    DocumentsModule,
    SettlementsModule,
    AuditModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
