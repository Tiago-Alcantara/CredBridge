import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

/**
 * Payload do callback enviado pelo microserviço Pix para a CredBridge.
 * Usado para validação e tipagem no controller de webhooks.
 */
export class PixWebhookDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  pixOrderId: string;

  @IsString()
  @IsNotEmpty()
  externalId: string;

  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  txid?: string | null;

  @IsString()
  @IsOptional()
  paymentId?: string | null;

  @IsString()
  @IsOptional()
  transactionId?: string | null;

  @IsString()
  @IsOptional()
  endToEndId?: string | null;

  @IsString()
  @IsOptional()
  confirmedAt?: string | null;

  @IsString()
  @IsOptional()
  failedAt?: string | null;

  @IsString()
  @IsOptional()
  failureReason?: string | null;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown> | null;
}

/**
 * Payload do callback de cobrança futura (collection).
 */
export class PixCollectionWebhookDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  type: 'COLLECTION';

  @IsString()
  @IsNotEmpty()
  collectionOrderId: string;

  @IsString()
  @IsNotEmpty()
  receivableId: string;

  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  endToEndId?: string | null;

  @IsString()
  @IsOptional()
  paidAt?: string | null;
}
