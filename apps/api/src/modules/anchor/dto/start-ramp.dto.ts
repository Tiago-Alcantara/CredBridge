import { IsNumber, IsPositive, IsString, IsOptional } from 'class-validator';

export class StartRampDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsOptional()
  quoteId?: string;
}
