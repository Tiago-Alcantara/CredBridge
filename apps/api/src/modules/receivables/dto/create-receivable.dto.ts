import {
  IsDateString,
  IsIn,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { ReceivableType } from '@credbridge/types';

const RECEIVABLE_TYPES: ReceivableType[] = ['invoice', 'duplicate', 'contract'];

export class CreateReceivableDto {
  @IsNumber()
  @IsPositive()
  value!: number;

  @IsIn(RECEIVABLE_TYPES)
  type!: ReceivableType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  debtorName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  debtorDocument!: string;

  @IsDateString()
  dueDate!: string;
}
