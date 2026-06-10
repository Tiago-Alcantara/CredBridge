import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SettlementsRepository } from './settlements.repository';

import { PrismaModule } from '../../shared/prisma/prisma.module';
import { BlockchainModule } from '../../shared/blockchain/blockchain.module';

@Module({
  imports: [AuthModule, PrismaModule, BlockchainModule],
  controllers: [SettlementsController],
  providers: [SettlementsService, SettlementsRepository],
  exports: [SettlementsService],
})
export class SettlementsModule {}
