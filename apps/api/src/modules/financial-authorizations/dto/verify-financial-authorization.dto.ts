import { IsObject, IsString, IsUUID } from 'class-validator';

export class VerifyFinancialAuthorizationDto {
  @IsUUID()
  authorizationId!: string;

  @IsString()
  payloadHash!: string;

  @IsObject()
  assertion!: Record<string, unknown>;
}
