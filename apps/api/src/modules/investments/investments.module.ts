import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';
import { InvestmentsRepository } from './investments.repository';

@Module({
  imports: [AuthModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService, InvestmentsRepository],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
