import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface CreateDepositOrderDto {
  externalId: string;
  ownerId: string;
  ownerRole: 'investor' | 'pme';
  amount: number;
  description?: string;
  expiresInSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateWithdrawalOrderDto {
  externalId: string;
  ownerId: string;
  ownerRole: 'investor' | 'pme';
  amount: number;
  pixKey: string;
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCollectionOrderDto {
  receivableId: string;
  pmeUserId: string;
  debtorName: string;
  debtorDocument: string;
  amount: number;
  dueDate: string;
  paymentDeadline: string;
  metadata?: Record<string, unknown>;
}

export interface PixOrderResponse {
  pixOrderId: string;
  externalId: string;
  identifier: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  ownerId: string;
  ownerRole: string;
  amount: number;
  status: string;
  corpxTxid: string | null;
  corpxPaymentId: string | null;
  endToEndId: string | null;
  qrCodePayload: string | null;
  qrCodeLocation: string | null;
  qrCodeBase64: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
  description: string | null;
  failureReason: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionOrderResponse {
  collectionOrderId: string;
  receivableId: string;
  identifier: string;
  amount: number;
  status: string;
  debtorName: string;
  debtorDocument: string;
  dueDate: string;
  qrCodePayload: string | null;
  qrCodeLocation: string | null;
  endToEndId: string | null;
  createdAt: string;
  paidAt: string | null;
}

/**
 * HTTP client para o microserviço Pix Python.
 *
 * Encapsula toda comunicação com o microserviço:
 *   - Injeta X-Api-Key em todos os requests
 *   - Mapeia snake_case da API Python para camelCase
 *   - Lança erros com contexto suficiente para logging
 */
@Injectable()
export class PixClient {
  private readonly logger = new Logger(PixClient.name);
  private readonly httpClient: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const baseUrl = this.config.get<string>('PIX_SERVICE_BASE_URL', 'http://localhost:8001');
    const apiKey = this.config.get<string>('PIX_SERVICE_API_KEY', '');

    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 15000,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async createDeposit(dto: CreateDepositOrderDto): Promise<PixOrderResponse> {
    this.logger.log(`Criando ordem de depósito no Pix service: externalId=${dto.externalId}`);
    const response = await this.httpClient.post<PixOrderResponse>('/v1/orders/deposits', {
      external_id: dto.externalId,
      owner_id: dto.ownerId,
      owner_role: dto.ownerRole,
      amount: dto.amount,
      description: dto.description,
      expires_in_seconds: dto.expiresInSeconds ?? 1800,
      metadata: dto.metadata,
    });
    return this.mapOrderResponse(response.data);
  }

  async createWithdrawal(dto: CreateWithdrawalOrderDto): Promise<PixOrderResponse> {
    this.logger.log(`Criando ordem de saque no Pix service: externalId=${dto.externalId}`);
    const response = await this.httpClient.post<PixOrderResponse>('/v1/orders/withdrawals', {
      external_id: dto.externalId,
      owner_id: dto.ownerId,
      owner_role: dto.ownerRole,
      amount: dto.amount,
      pix_key: dto.pixKey,
      pix_key_type: dto.pixKeyType,
      description: dto.description,
      metadata: dto.metadata,
    });
    return this.mapOrderResponse(response.data);
  }

  async getOrderById(pixOrderId: string): Promise<PixOrderResponse> {
    const response = await this.httpClient.get<PixOrderResponse>(
      `/v1/orders/${pixOrderId}`,
    );
    return this.mapOrderResponse(response.data);
  }

  async getOrderByExternalId(externalId: string): Promise<PixOrderResponse> {
    const response = await this.httpClient.get<PixOrderResponse>(
      `/v1/orders/by-external-id/${externalId}`,
    );
    return this.mapOrderResponse(response.data);
  }

  async cancelOrder(pixOrderId: string): Promise<PixOrderResponse> {
    const response = await this.httpClient.post<PixOrderResponse>(
      `/v1/orders/${pixOrderId}/cancel`,
    );
    return this.mapOrderResponse(response.data);
  }

  async refreshOrder(pixOrderId: string): Promise<PixOrderResponse> {
    const response = await this.httpClient.post<PixOrderResponse>(
      `/v1/orders/${pixOrderId}/refresh`,
    );
    return this.mapOrderResponse(response.data);
  }

  async createCollection(dto: CreateCollectionOrderDto): Promise<CollectionOrderResponse> {
    this.logger.log(
      `Criando cobrança futura no Pix service: receivableId=${dto.receivableId}`,
    );
    const response = await this.httpClient.post<CollectionOrderResponse>('/v1/collections', {
      receivable_id: dto.receivableId,
      pme_user_id: dto.pmeUserId,
      debtor_name: dto.debtorName,
      debtor_document: dto.debtorDocument,
      amount: dto.amount,
      due_date: dto.dueDate,
      payment_deadline: dto.paymentDeadline,
      metadata: dto.metadata,
    });
    return this.mapCollectionResponse(response.data);
  }

  async getCollection(collectionId: string): Promise<CollectionOrderResponse> {
    const response = await this.httpClient.get<CollectionOrderResponse>(
      `/v1/collections/${collectionId}`,
    );
    return this.mapCollectionResponse(response.data);
  }

  async cancelCollection(collectionId: string): Promise<CollectionOrderResponse> {
    const response = await this.httpClient.post<CollectionOrderResponse>(
      `/v1/collections/${collectionId}/cancel`,
    );
    return this.mapCollectionResponse(response.data);
  }

  // ------------------------------------------------------------------ //
  // Mappers snake_case → camelCase
  // ------------------------------------------------------------------ //

  private mapOrderResponse(data: any): PixOrderResponse {
    return {
      pixOrderId: data['pix_order_id'] as string,
      externalId: data['external_id'] as string,
      identifier: data['identifier'] as string,
      type: data['type'] as 'DEPOSIT' | 'WITHDRAWAL',
      ownerId: data['owner_id'] as string,
      ownerRole: data['owner_role'] as string,
      amount: data['amount'] as number,
      status: data['status'] as string,
      corpxTxid: (data['corpx_txid'] ?? null) as string | null,
      corpxPaymentId: (data['corpx_payment_id'] ?? null) as string | null,
      endToEndId: (data['end_to_end_id'] ?? null) as string | null,
      qrCodePayload: (data['qr_code_payload'] ?? null) as string | null,
      qrCodeLocation: (data['qr_code_location'] ?? null) as string | null,
      qrCodeBase64: (data['qr_code_base64'] ?? null) as string | null,
      pixKey: (data['pix_key'] ?? null) as string | null,
      pixKeyType: (data['pix_key_type'] ?? null) as string | null,
      description: (data['description'] ?? null) as string | null,
      failureReason: (data['failure_reason'] ?? null) as string | null,
      expiresAt: (data['expires_at'] ?? null) as string | null,
      confirmedAt: (data['confirmed_at'] ?? null) as string | null,
      failedAt: (data['failed_at'] ?? null) as string | null,
      createdAt: data['created_at'] as string,
      updatedAt: data['updated_at'] as string,
    };
  }

  private mapCollectionResponse(data: any): CollectionOrderResponse {
    return {
      collectionOrderId: data['collection_order_id'] as string,
      receivableId: data['receivable_id'] as string,
      identifier: data['identifier'] as string,
      amount: data['amount'] as number,
      status: data['status'] as string,
      debtorName: data['debtor_name'] as string,
      debtorDocument: data['debtor_document'] as string,
      dueDate: data['due_date'] as string,
      qrCodePayload: (data['qr_code_payload'] ?? null) as string | null,
      qrCodeLocation: (data['qr_code_location'] ?? null) as string | null,
      endToEndId: (data['end_to_end_id'] ?? null) as string | null,
      createdAt: data['created_at'] as string,
      paidAt: (data['paid_at'] ?? null) as string | null,
    };
  }
}
