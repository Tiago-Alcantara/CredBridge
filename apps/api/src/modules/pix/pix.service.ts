import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StellarService } from '../../shared/blockchain/stellar.service';
import {
  PixClient,
  PixOrderResponse,
  CollectionOrderResponse,
} from './pix.client';
import { PixWebhookDto, PixCollectionWebhookDto } from './dto/pix-webhook.dto';
import { CreatePixDepositDto } from './dto/create-pix-deposit.dto';
import { CreatePixWithdrawalDto } from './dto/create-pix-withdrawal.dto';

/**
 * Serviço Pix da CredBridge.
 *
 * Responsabilidades:
 *   - Criar ordens de depósito e saque via PixClient
 *   - Atualizar Transaction no banco com dados Pix
 *   - Processar callbacks do microserviço Pix
 *   - Acionar efeitos on-chain (mintBrlt, burn) após confirmação Pix
 *   - Processar liquidação de cobranças futuras (collection)
 *
 * Não processa webhooks CorpX diretamente — isso é delegado ao microserviço.
 */
@Injectable()
export class PixService {
  private readonly logger = new Logger(PixService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
    private readonly pixClient: PixClient,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------------------------------------------ //
  // Criação de ordens
  // ------------------------------------------------------------------ //

  async createDepositOrder(
    dto: CreatePixDepositDto,
    operatorId: string,
  ) {
    const investor = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!investor) {
      throw new NotFoundException('Investidor não encontrado');
    }

    // Cria a Transaction no banco local com status PENDING_PAYMENT
    const transaction = await this.prisma.transaction.create({
      data: {
        userId: dto.userId,
        type: 'DEPOSIT',
        amount: dto.amount,
        status: 'PENDING_PAYMENT',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        event: 'pix.deposit.created',
        entityId: transaction.id,
        entityType: 'transaction',
        userId: operatorId === 'system' ? dto.userId : operatorId,
        metadata: { amount: dto.amount, investorId: dto.userId },
      },
    });

    // Cria QR Code no microserviço Pix
    const pixOrder = await this.pixClient.createDeposit({
      externalId: transaction.id,
      ownerId: dto.userId,
      ownerRole: 'investor',
      amount: dto.amount,
      description: dto.description ?? 'Aporte CredBridge',
      expiresInSeconds: dto.expiresInSeconds ?? Number(
        this.config.get('PIX_DEPOSIT_EXPIRATION_SECONDS', '1800'),
      ),
      metadata: {
        credbridgeEntityType: 'transaction',
        credbridgeEntityId: transaction.id,
        ...dto.metadata,
      },
    });

    // Persiste dados Pix na Transaction
    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        pixOrderId: pixOrder.pixOrderId,
        pixIdentifier: pixOrder.identifier,
        pixTxid: pixOrder.corpxTxid ?? undefined,
        pixQrCodePayload: pixOrder.qrCodePayload ?? undefined,
        pixQrCodeLocation: pixOrder.qrCodeLocation ?? undefined,
        pixQrCodeBase64: pixOrder.qrCodeBase64 ?? undefined,
        pixExpiresAt: pixOrder.expiresAt ? new Date(pixOrder.expiresAt) : undefined,
      },
    });

    this.logger.log(
      `Depósito Pix criado: transaction=${transaction.id} pixOrder=${pixOrder.pixOrderId} identifier=${pixOrder.identifier}`,
    );

    return { transaction: updatedTransaction, pixOrder };
  }

  async buildWithdrawalTx(userId: string, amount: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { privyStellarWalletAddress: true, stellarWalletId: true },
    });
    const address = user?.privyStellarWalletAddress ?? user?.stellarWalletId;
    if (!address) {
      throw new BadRequestException('Usuário não possui carteira Stellar configurada');
    }

    // Valida o saldo de BRLT on-chain antes de gerar a transação de queima (burn)
    try {
      const balance = await this.stellar.getBrltBalance(address);
      if (balance.balance.value < amount) {
        throw new BadRequestException(
          `Saldo insuficiente em BRLT (disponível: ${balance.balance.value.toFixed(2)})`,
        );
      }
    } catch (err) {
      this.logger.warn(`Erro ao buscar saldo BRLT on-chain para validação: ${(err as Error).message}`);
    }

    return this.stellar.buildBurnBrltTx(address, amount);
  }

  async submitWithdrawal(
    userId: string,
    dto: {
      amount: number;
      pixKey: string;
      pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
      xdr: string;
      signature: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { privyStellarWalletAddress: true, stellarWalletId: true },
    });
    const address = user?.privyStellarWalletAddress ?? user?.stellarWalletId;
    if (!address) {
      throw new BadRequestException('Usuário não possui carteira Stellar configurada');
    }

    // 1. Submeter transação de queima (burn) on-chain
    this.logger.log(`Submetendo transação de queima on-chain para saque: userId=${userId} amount=${dto.amount}`);
    const burnTxHash = await this.stellar.submitSignedTx({
      xdr: dto.xdr,
      signerPublicKey: address,
      signatureHex: dto.signature,
    });

    this.logger.log(`Queima on-chain de BRLT realizada com sucesso: txHash=${burnTxHash}`);

    // 2. Criar a ordem de saque via PixClient com o hash de queima nos metadados
    const withdrawalOrder = await this.createWithdrawalOrder(
      {
        userId,
        amount: dto.amount,
        pixKey: dto.pixKey,
        pixKeyType: dto.pixKeyType,
        description: `Saque CredBridge via Pix`,
        metadata: { burnTxHash },
      },
      userId,
    );

    return {
      status: 'PROCESSING',
      txHash: burnTxHash,
      pixOrderId: withdrawalOrder.pixOrder.pixOrderId,
    };
  }

  async createWithdrawalOrder(dto: CreatePixWithdrawalDto, requesterId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // IMPORTANTE: o BRLT deve ser queimado ANTES de enviar o Pix Out
    // Esta validação verifica que o burn foi realizado (por um serviço upstream)
    // antes de chamar o Pix service. Nesta versão, o caller é responsável
    // por garantir que o burn ocorreu antes.

    const transaction = await this.prisma.transaction.create({
      data: {
        userId: dto.userId,
        type: 'WITHDRAWAL',
        amount: dto.amount,
        status: 'PROCESSING',
        pixKey: dto.pixKey,
        txHash: (dto.metadata?.burnTxHash as string) || null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        event: 'pix.withdrawal.created',
        entityId: transaction.id,
        entityType: 'transaction',
        userId: requesterId === 'system' ? dto.userId : requesterId,
        metadata: { amount: dto.amount, pixKey: dto.pixKey },
      },
    });

    const pixOrder = await this.pixClient.createWithdrawal({
      externalId: transaction.id,
      ownerId: dto.userId,
      ownerRole: user.role === 'pme' ? 'pme' : 'investor',
      amount: dto.amount,
      pixKey: dto.pixKey,
      pixKeyType: dto.pixKeyType,
      description: dto.description ?? 'Saque CredBridge',
      metadata: dto.metadata,
    });

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        pixOrderId: pixOrder.pixOrderId,
        pixIdentifier: pixOrder.identifier,
        pixPaymentId: pixOrder.corpxPaymentId ?? undefined,
      },
    });

    this.logger.log(
      `Saque Pix criado: transaction=${transaction.id} pixOrder=${pixOrder.pixOrderId}`,
    );

    return { transaction, pixOrder };
  }

  // ------------------------------------------------------------------ //
  // Consultas
  // ------------------------------------------------------------------ //

  async getPixOrderForTransaction(transactionId: string, userId: string): Promise<PixOrderResponse | null> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    if (!transaction.pixOrderId) {
      return null;
    }

    return this.pixClient.getOrderById(transaction.pixOrderId);
  }

  async listUserTransactionsWithPixStatus(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return transactions;
  }

  async refreshPixOrder(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!transaction || !transaction.pixOrderId) {
      throw new NotFoundException('Ordem Pix não encontrada para esta transação');
    }

    return this.pixClient.refreshOrder(transaction.pixOrderId);
  }

  // ------------------------------------------------------------------ //
  // Processamento de webhooks
  // ------------------------------------------------------------------ //

  async processPixOrderCallback(dto: PixWebhookDto): Promise<void> {
    // Idempotência: verifica se já processamos este eventId
    const alreadyProcessed = await this.prisma.pixWebhookEvent.findUnique({
      where: { eventId: dto.eventId },
    });

    if (alreadyProcessed) {
      this.logger.log(`Evento Pix duplicado ignorado: eventId=${dto.eventId}`);
      return;
    }

    // Persiste o evento ANTES de qualquer efeito (garante idempotência em retry)
    await this.prisma.pixWebhookEvent.create({
      data: {
        eventId: dto.eventId,
        pixOrderId: dto.pixOrderId,
        externalId: dto.externalId,
        identifier: dto.identifier,
        type: dto.type,
        status: dto.status,
        amount: dto.amount,
        payload: dto as any,
      },
    });

    // Localiza a Transaction CredBridge pelo externalId (= transaction.id)
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.externalId },
      include: { user: true },
    });

    if (!transaction) {
      this.logger.warn(
        `Transaction não encontrada para callback Pix: externalId=${dto.externalId}`,
      );
      return;
    }

    // Atualiza campos Pix na Transaction
    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        pixEndToEndId: dto.endToEndId ?? undefined,
        pixConfirmedAt: dto.confirmedAt ? new Date(dto.confirmedAt) : undefined,
        pixFailureReason: dto.failureReason ?? undefined,
        pixPaymentId: dto.paymentId ?? undefined,
        pixTransactionId: dto.transactionId ?? undefined,
      },
    });

    if (dto.status === 'CONFIRMED' && dto.type === 'DEPOSIT') {
      await this.handleDepositConfirmed(transaction, dto);
    } else if (dto.status === 'CONFIRMED' && dto.type === 'WITHDRAWAL') {
      await this.handleWithdrawalConfirmed(transaction, dto);
    } else if (dto.status === 'FAILED') {
      await this.handleOrderFailed(transaction, dto);
    } else if (dto.status === 'EXPIRED') {
      await this.handleOrderExpired(transaction, dto);
    }
  }

  async processCollectionCallback(dto: PixCollectionWebhookDto): Promise<void> {
    const alreadyProcessed = await this.prisma.pixWebhookEvent.findUnique({
      where: { eventId: dto.eventId },
    });

    if (alreadyProcessed) {
      this.logger.log(`Evento de cobrança duplicado ignorado: eventId=${dto.eventId}`);
      return;
    }

    await this.prisma.pixWebhookEvent.create({
      data: {
        eventId: dto.eventId,
        pixOrderId: dto.collectionOrderId,
        externalId: dto.receivableId,
        identifier: dto.identifier,
        type: 'COLLECTION',
        status: dto.status,
        amount: dto.amount,
        payload: dto as any,
      },
    });

    if (dto.status !== 'PAID') {
      return;
    }

    // Atualiza ReceivableCollection
    const collection = await this.prisma.receivableCollection.findFirst({
      where: { identifier: dto.identifier },
    });

    if (collection) {
      await this.prisma.receivableCollection.update({
        where: { id: collection.id },
        data: {
          status: 'paid',
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          endToEndId: dto.endToEndId ?? undefined,
        },
      });
    }

    // Aciona liquidação on-chain do recebível (settle_invoice_in_pool + settle_nfe)
    this.logger.log(
      `Cobrança paga — iniciando liquidação on-chain: receivableId=${dto.receivableId}`,
    );

    // Localiza o recebível para atribuir o log de auditoria ao usuário correto (PME)
    const receivable = await this.prisma.receivable.findUnique({
      where: { id: dto.receivableId },
    });
    let logUserId = receivable?.userId;
    if (!logUserId) {
      const fallbackUser = await this.prisma.user.findFirst({ select: { id: true } });
      logUserId = fallbackUser?.id;
    }

    if (logUserId) {
      await this.prisma.auditLog.create({
        data: {
          event: 'pix.collection.paid',
          entityId: dto.receivableId,
          entityType: 'receivable',
          userId: logUserId,
          metadata: {
            collectionOrderId: dto.collectionOrderId,
            endToEndId: dto.endToEndId,
            amount: dto.amount,
          },
        },
      });
    } else {
      this.logger.warn(
        `Não foi possível criar log de auditoria para cobrança paga — nenhum usuário cadastrado no sistema.`,
      );
    }

    // TODO: chamar SettlementsService.settleInvoice(dto.receivableId) quando implementado
  }

  // ------------------------------------------------------------------ //
  // Handlers de status
  // ------------------------------------------------------------------ //

  private async handleDepositConfirmed(
    transaction: { id: string; userId: string; amount: number; user: { privyStellarWalletAddress: string | null; stellarWalletId: string | null } },
    dto: PixWebhookDto,
  ): Promise<void> {
    this.logger.log(
      `Depósito Pix confirmado — mintando BRLT: transaction=${transaction.id} amount=${dto.amount}`,
    );

    const walletAddress =
      transaction.user.privyStellarWalletAddress ?? transaction.user.stellarWalletId;

    if (!walletAddress) {
      this.logger.error(
        `Investidor sem carteira Stellar: userId=${transaction.userId} transaction=${transaction.id}`,
      );
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          pixFailureReason: 'Carteira Stellar não configurada para o investidor',
        },
      });
      return;
    }

    try {
      const txHash = await this.stellar.mintBrlt(walletAddress, dto.amount);

      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'APPROVED',
          txHash,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          event: 'pix.deposit.confirmed',
          entityId: transaction.id,
          entityType: 'transaction',
          userId: transaction.userId,
          txHash,
          metadata: {
            pixOrderId: dto.pixOrderId,
            endToEndId: dto.endToEndId,
            amount: dto.amount,
          },
        },
      });

      this.logger.log(
        `BRLT mintado com sucesso: transaction=${transaction.id} txHash=${txHash}`,
      );
    } catch (mintError) {
      this.logger.error(
        `Falha ao mintar BRLT: transaction=${transaction.id} error=${mintError}`,
      );
      // Não atualiza status aqui — operador precisa revisar manualmente
      await this.prisma.auditLog.create({
        data: {
          event: 'pix.deposit.mint_failed',
          entityId: transaction.id,
          entityType: 'transaction',
          userId: transaction.userId,
          metadata: { error: String(mintError) },
        },
      });
    }
  }

  private async handleWithdrawalConfirmed(
    transaction: { id: string; userId: string; amount: number },
    dto: PixWebhookDto,
  ): Promise<void> {
    this.logger.log(`Saque Pix confirmado: transaction=${transaction.id}`);

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'COMPLETED' },
    });

    await this.prisma.auditLog.create({
      data: {
        event: 'pix.withdrawal.confirmed',
        entityId: transaction.id,
        entityType: 'transaction',
        userId: transaction.userId,
        metadata: {
          pixOrderId: dto.pixOrderId,
          endToEndId: dto.endToEndId,
          amount: dto.amount,
        },
      },
    });
  }

  private async handleOrderFailed(
    transaction: { id: string; userId: string },
    dto: PixWebhookDto,
  ): Promise<void> {
    this.logger.warn(`Ordem Pix falhou: transaction=${transaction.id} reason=${dto.failureReason}`);

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'FAILED',
        pixFailureReason: dto.failureReason ?? 'Falha no processamento Pix',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        event: 'pix.order.failed',
        entityId: transaction.id,
        entityType: 'transaction',
        userId: transaction.userId,
        metadata: {
          pixOrderId: dto.pixOrderId,
          failureReason: dto.failureReason,
          type: dto.type,
        },
      },
    });
  }

  private async handleOrderExpired(
    transaction: { id: string; userId: string },
    dto: PixWebhookDto,
  ): Promise<void> {
    this.logger.log(`QR Code Pix expirado: transaction=${transaction.id}`);

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'EXPIRED' },
    });

    await this.prisma.auditLog.create({
      data: {
        event: 'pix.deposit.expired',
        entityId: transaction.id,
        entityType: 'transaction',
        userId: transaction.userId,
        metadata: { pixOrderId: dto.pixOrderId },
      },
    });
  }
}
