import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateInvestmentDto {
  @IsUUID()
  receivableId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pixTxId?: string;
}
