import { IsNumber, IsPositive, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class StartRampDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ValidateIf((o) => o.quoteId !== undefined && o.quoteId !== '')
  @IsUUID()
  @IsOptional()
  quoteId?: string;
}
