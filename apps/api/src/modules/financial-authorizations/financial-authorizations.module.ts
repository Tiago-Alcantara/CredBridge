import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FinancialAuthorizationsController } from './financial-authorizations.controller';
import { FinancialAuthorizationsService } from './financial-authorizations.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FinancialAuthorizationsController],
  providers: [FinancialAuthorizationsService],
  exports: [FinancialAuthorizationsService],
})
export class FinancialAuthorizationsModule {}
