import {
  IsIn,
  IsNumber,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import type { SettlementMethod } from '@credbridge/types';

const SETTLEMENT_METHODS: SettlementMethod[] = ['pix', 'ted', 'stellar'];

export class CreateSettlementDto {
  @IsString()
  @MinLength(1)
  receivableId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsIn(SETTLEMENT_METHODS)
  method!: SettlementMethod;
}
