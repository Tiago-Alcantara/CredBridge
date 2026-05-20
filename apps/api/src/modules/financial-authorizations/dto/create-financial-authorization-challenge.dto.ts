import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { FinancialOperation } from '../financial-authorization.types';

const OPERATIONS: FinancialOperation[] = [
  'receivable.tokenize',
  'receivable.assignment',
  'pme.withdrawal',
  'investor.deposit',
  'investment.purchase',
  'investor.withdrawal',
];

export class CreateFinancialAuthorizationChallengeDto {
  @IsIn(OPERATIONS)
  operation!: FinancialOperation;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  resourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  destination?: string;
}
