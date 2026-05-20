import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateInvestmentDto {
  @IsUUID()
  receivableId!: string;

  @IsUUID()
  authorizationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pixTxId?: string;
}
