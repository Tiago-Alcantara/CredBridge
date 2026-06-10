import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { BlockchainModule } from '../../shared/blockchain/blockchain.module';
import { PixClient } from './pix.client';
import { PixService } from './pix.service';
import { PixController } from './pix.controller';
import { SettlementsModule } from '../settlements/settlements.module';

/**
 * Módulo Pix da CredBridge.
 *
 * Encapsula toda a integração com o microserviço Pix Python:
 *   - PixClient: HTTP client para o microserviço
 *   - PixService: lógica de negócio (mint BRLT, atualizar Transaction, etc.)
 *   - PixController: endpoints REST + webhook receiver
 *
 * Depende de:
 *   - PrismaModule: acesso ao banco de dados
 *   - BlockchainModule: mintBrlt e operações Stellar
 *   - ConfigModule: variáveis de ambiente PIX_SERVICE_BASE_URL, PIX_SERVICE_API_KEY, etc.
 */
@Module({
  imports: [ConfigModule, PrismaModule, BlockchainModule, SettlementsModule],
  providers: [PixClient, PixService],
  controllers: [PixController],
  exports: [PixService, PixClient],
})
export class PixModule {}
