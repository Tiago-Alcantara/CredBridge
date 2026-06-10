import {
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ReceivablesRepository } from './receivables.repository';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { toReceivableResponse } from './dto/receivable-response.dto';
import { AuditService } from '../audit/audit.service';
import { FinancialAuthorizationsService } from '../financial-authorizations/financial-authorizations.service';
import type { BlockchainService } from '../../shared/blockchain/blockchain.interface';
import { BLOCKCHAIN_SERVICE } from '../../shared/blockchain/blockchain.interface';
import { PixService } from '../pix/pix.service';

@Injectable()
export class ReceivablesService {
  private readonly logger = new Logger(ReceivablesService.name);

  constructor(
    private readonly repo: ReceivablesRepository,
    private readonly audit: AuditService,
    @Inject(BLOCKCHAIN_SERVICE) private readonly blockchain: BlockchainService,
    private readonly financialAuthorizations: FinancialAuthorizationsService,
    private readonly pixService: PixService,
  ) {}

  async create(userId: string, data: CreateReceivableDto) {
    const receivable = await this.repo.create(userId, data);

    await this.audit.log({
      event: 'receivable.created',
      entityId: receivable.id,
      entityType: 'receivable',
      userId,
      metadata: {
        value: receivable.value,
        type: receivable.type,
        debtorName: receivable.debtorName,
        debtorDocument: receivable.debtorDocument,
        dueDate: receivable.dueDate.toISOString(),
      },
    });

    return toReceivableResponse(receivable);
  }

  async findAll(userId: string) {
    return (await this.repo.findAll(userId)).map(toReceivableResponse);
  }

  async findOne(id: string) {
    const r = await this.repo.findOne(id);
    return r ? toReceivableResponse(r) : null;
  }

  async findPool() {
    return (await this.repo.findPool()).map(toReceivableResponse);
  }

  async activate(id: string) {
    return this.tokenize(id);
  }

  async tokenize(id: string) {
    const receivable = await this.repo.findOne(id);
    if (!receivable) throw new NotFoundException(`Receivable ${id} not found`);
    if (receivable.status !== 'validated') {
      throw new ConflictException(
        'Receivable must be validated before tokenization',
      );
    }

    await this.audit.log({
      event: 'receivable.ready_for_blockchain',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      metadata: { network: 'stellar', contract: 'soroban-nft' },
    });

    await this.audit.log({
      event: 'receivable.nft_minting',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      metadata: {
        value: receivable.value,
        xmlHash: receivable.documentHash ?? null,
      },
    });

    const txHash = await this.blockchain.tokenizeNfe({
      key: receivable.id,
      value: receivable.value,
      dueDate: receivable.dueDate,
      xmlHash: receivable.documentHash ?? null,
      ownerUserId: receivable.userId,
    });

    const tokenized = await this.repo.setTokenized(id, txHash);

    await this.audit.log({
      event: 'receivable.tokenized_by_policy',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      txHash,
      metadata: { network: 'stellar', authorization: 'policy' },
    });

    await this.audit.log({
      event: 'receivable.tx_confirmed',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      txHash,
      metadata: { network: 'stellar', status: 'success' },
    });

    return toReceivableResponse(tokenized);
  }

  async requestAssignment(id: string) {
    const receivable = await this.repo.findOne(id);
    if (!receivable) throw new NotFoundException(`Receivable ${id} not found`);
    if (receivable.status !== 'tokenized') {
      throw new ConflictException(
        'Receivable must be tokenized before assignment',
      );
    }

    const updated = await this.repo.setAssignmentPending(id);
    return toReceivableResponse(updated);
  }

  async assign(id: string, authorizationId: string) {
    const receivable = await this.repo.findOne(id);
    if (!receivable) throw new NotFoundException(`Receivable ${id} not found`);
    if (
      receivable.status !== 'tokenized' &&
      receivable.status !== 'assignment_pending'
    ) {
      throw new ConflictException(
        'Receivable must be tokenized before assignment',
      );
    }

    await this.financialAuthorizations.consume({
      authorizationId,
      userId: receivable.userId,
      operation: 'receivable.assignment',
      resourceId: receivable.id,
      amount: receivable.value.toFixed(2),
      destination: 'credbridge-pool',
    });

    const txHash = await this.blockchain.transferNftToPlatform(receivable.id);
    const updated = await this.repo.setActive(id);

    await this.audit.log({
      event: 'receivable.assignment_signed',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      txHash,
      metadata: { authorizationId },
    });

    return toReceivableResponse(updated);
  }

  async prepareAssignment(id: string) {
    const receivable = await this.repo.findOne(id);
    if (!receivable) throw new NotFoundException(`Receivable ${id} not found`);
    if (
      receivable.status !== 'tokenized' &&
      receivable.status !== 'assignment_pending'
    ) {
      throw new ConflictException(
        'Receivable must be tokenized before assignment',
      );
    }

    const pmeWallet = await this.repo.findUserStellarWallet(receivable.userId);
    if (!pmeWallet || !pmeWallet.privyStellarWalletAddress) {
      throw new NotFoundException(
        `Stellar privy wallet for user ${receivable.userId} not found`,
      );
    }

    const prepared = await this.blockchain.prepareAssignment(
      receivable.id,
      pmeWallet.privyStellarWalletAddress,
    );

    return {
      unsignedXdr: prepared.unsignedXdr,
      hashToSign: prepared.hashToSign,
      pmeAddress: pmeWallet.privyStellarWalletAddress,
      receivable: toReceivableResponse(receivable),
    };
  }

  async submitAssignment(
    id: string,
    data: { unsignedXdr: string; signatureHex: string },
  ) {
    const receivable = await this.repo.findOne(id);
    if (!receivable) throw new NotFoundException(`Receivable ${id} not found`);
    if (
      receivable.status !== 'tokenized' &&
      receivable.status !== 'assignment_pending'
    ) {
      throw new ConflictException(
        'Receivable must be tokenized before assignment',
      );
    }

    const pmeWallet = await this.repo.findUserStellarWallet(receivable.userId);
    if (!pmeWallet || !pmeWallet.privyStellarWalletAddress) {
      throw new NotFoundException(
        `Stellar privy wallet for user ${receivable.userId} not found`,
      );
    }

    const txHash = await this.blockchain.submitSignedAssignment(
      data.unsignedXdr,
      data.signatureHex,
      pmeWallet.privyStellarWalletAddress,
    );

    // Efetua a compra real on-chain pela Pool de Liquidez para transferir os BRLT ao PME
    try {
      this.logger.log(`Executing buyTokenizedInvoiceInPool to pay BRLT to PME Privy wallet...`);
      await this.blockchain.buyTokenizedInvoiceInPool({
        sellerAddress: pmeWallet.privyStellarWalletAddress,
        invoiceKey: receivable.id,
        xmlHash: receivable.documentHash ?? '00000000000000000000000000000000',
        value: receivable.value,
      });
    } catch (err) {
      this.logger.error(`Failed to buy tokenized invoice in Pool: ${(err as Error).message}`);
      // Lança o erro de transação para que o fluxo mostre visualmente a falta de liquidez
      // se a pool ainda não tiver aportes! Isso garante fidelidade total à blockchain.
      throw new ConflictException(
        `Failed to complete financial transfer from Pool: ${(err as Error).message}. Certifique-se de que a Pool possui liquidez suficiente de aportes.`,
      );
    }

    const updated = await this.repo.setActive(id);

    // Etapa 3: Criar cobrança Pix para o Sacado (devedor)
    try {
      this.logger.log(`Criando cobrança Pix para o sacado do recebível ${id}...`);
      await this.pixService.createCollectionOrder({
        receivableId: receivable.id,
        pmeUserId: receivable.userId,
        debtorName: receivable.debtorName,
        debtorDocument: receivable.debtorDocument,
        amount: receivable.value, // Valor total nominal
        dueDate: receivable.dueDate,
      });
    } catch (collectionErr) {
      this.logger.error(
        `Falha ao iniciar cobrança do sacado no Pix Service: ${(collectionErr as Error).message}`,
      );
      // Não bloqueia o fluxo de cessão, pois a cessão on-chain e o pagamento
      // do PME foram concluídos com sucesso.
    }

    await this.audit.log({
      event: 'receivable.assignment_signed',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      txHash,
      metadata: { source: 'privy_blockchain_signing' },
    });

    return toReceivableResponse(updated);
  }

  async getPoolStats() {
    return this.repo.getPoolStats();
  }
}
