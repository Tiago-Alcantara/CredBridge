import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReceivablesController } from './receivables.controller';
import { ReceivablesService } from './receivables.service';
import { ReceivablesRepository } from './receivables.repository';

@Module({
  imports: [AuthModule],
  controllers: [ReceivablesController],
  providers: [ReceivablesService, ReceivablesRepository],
  exports: [ReceivablesService],
})
export class ReceivablesModule {}
