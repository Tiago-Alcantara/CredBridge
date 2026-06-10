import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PixService } from './pix.service';
import { PixWebhookDto, PixCollectionWebhookDto } from './dto/pix-webhook.dto';
import { CreatePixDepositDto } from './dto/create-pix-deposit.dto';
import { CreatePixWithdrawalDto } from './dto/create-pix-withdrawal.dto';
import { verifyPixCallbackSignature } from './pix-signature';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Controller do módulo Pix na CredBridge.
 *
 * Endpoints:
 *   POST /v1/pix/deposits         — operador cria depósito com QR
 *   POST /v1/pix/withdrawals      — operador/usuário cria saque
 *   GET  /v1/pix/orders           — lista ordens do usuário autenticado
 *   GET  /v1/pix/orders/:id       — detalhe de uma ordem
 *   POST /v1/pix/orders/:id/refresh — reconciliação defensiva
 *   POST /v1/pix/webhooks/orders  — callback do microserviço Pix
 */
@Controller('pix')
export class PixController {
  private readonly logger = new Logger(PixController.name);

  constructor(
    private readonly pixService: PixService,
    private readonly config: ConfigService,
  ) {}

  @Post('deposits')
  async createDeposit(
    @Body() dto: CreatePixDepositDto,
    @Req() req: any,
  ) {
    // Operador ID: em produção, virá do JWT. Por ora usa o userId do body ou 'system'.
    const operatorId = (req as unknown as { user?: { id: string } }).user?.id ?? 'system';
    return this.pixService.createDepositOrder(dto, operatorId);
  }

  @Post('withdrawals')
  async createWithdrawal(
    @Body() dto: CreatePixWithdrawalDto,
    @Req() req: any,
  ) {
    const requesterId = (req as unknown as { user?: { id: string } }).user?.id ?? 'system';
    return this.pixService.createWithdrawalOrder(dto, requesterId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('withdrawals/build')
  async buildWithdrawal(
    @Req() req: any,
    @Body() dto: { amount: number },
  ) {
    const userId = req.user.userId;
    return this.pixService.buildWithdrawalTx(userId, dto.amount);
  }

  @UseGuards(JwtAuthGuard)
  @Post('withdrawals/submit')
  async submitWithdrawal(
    @Req() req: any,
    @Body() dto: { amount: number; pixKey: string; pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'; xdr: string; signature: string },
  ) {
    const userId = req.user.userId;
    return this.pixService.submitWithdrawal(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('collections/active')
  async listActiveCollections(@Req() req: any) {
    const userId = req.user.userId;
    const role = req.user.role;
    return this.pixService.listActiveCollections(userId, role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('collections/:id/retry')
  async retryCollection(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.pixService.retryCollectionOrder(id, userId);
  }

  @Get('orders')
  async listOrders(
    @Query('userId') userId: string,
    @Req() req: any,
  ) {
    // Por ora aceita userId por query param (operador vê qualquer usuário)
    const resolvedUserId =
      userId ?? (req as unknown as { user?: { id: string } }).user?.id;

    if (!resolvedUserId) {
      throw new NotFoundException('userId é obrigatório');
    }

    return this.pixService.listUserTransactionsWithPixStatus(resolvedUserId);
  }

  @Get('orders/:transactionId')
  async getOrder(
    @Param('transactionId') transactionId: string,
    @Query('userId') userId: string,
    @Req() req: any,
  ) {
    const resolvedUserId =
      userId ?? (req as unknown as { user?: { id: string } }).user?.id ?? 'system';

    return this.pixService.getPixOrderForTransaction(transactionId, resolvedUserId);
  }

  @Post('orders/:transactionId/refresh')
  async refreshOrder(
    @Param('transactionId') transactionId: string,
    @Query('userId') userId: string,
    @Req() req: any,
  ) {
    const resolvedUserId =
      userId ?? (req as unknown as { user?: { id: string } }).user?.id ?? 'system';

    return this.pixService.refreshPixOrder(transactionId, resolvedUserId);
  }

  /**
   * Endpoint que recebe callbacks do microserviço Pix.
   *
   * Valida assinatura HMAC antes de processar qualquer dado.
   * Retorna 200 imediatamente para o microserviço Pix (que fará retry em caso de erro).
   */
  @Post('webhooks/orders')
  @HttpCode(HttpStatus.OK)
  async receivePixWebhook(
    @Req() req: any,
    @Body() body: PixWebhookDto | PixCollectionWebhookDto,
  ) {
    const rawBody = (req as { rawBody?: Buffer }).rawBody;
    const signatureHeader = req.headers['x-credbridge-pix-signature'] as string | undefined;
    const timestampHeader = req.headers['x-credbridge-pix-timestamp'] as string | undefined;
    const eventId = req.headers['x-credbridge-pix-event-id'] as string | undefined;

    const webhookSecret = this.config.get<string>('PIX_WEBHOOK_SECRET', '');
    const maxSkew = Number(this.config.get<string>('PIX_WEBHOOK_MAX_SKEW_SECONDS', '300'));

    if (webhookSecret && rawBody) {
      const isValid = verifyPixCallbackSignature(
        rawBody,
        signatureHeader,
        timestampHeader,
        webhookSecret,
        maxSkew,
      );

      if (!isValid) {
        this.logger.warn(
          `Assinatura Pix webhook inválida — eventId=${eventId} ip=${req.ip}`,
        );
        throw new UnauthorizedException('Assinatura do webhook Pix inválida');
      }
    }

    this.logger.log(`Recebendo callback Pix: eventId=${eventId} type=${(body as PixWebhookDto).type}`);

    // Distingue callbacks de ordem e de cobrança futura pelo campo `type`
    if ((body as PixCollectionWebhookDto).type === 'COLLECTION') {
      await this.pixService.processCollectionCallback(body as PixCollectionWebhookDto);
    } else {
      await this.pixService.processPixOrderCallback(body as PixWebhookDto);
    }

    return { status: 'ok' };
  }
}
