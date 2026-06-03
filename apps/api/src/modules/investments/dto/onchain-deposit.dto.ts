import { IsIn, IsString, MinLength } from 'class-validator';

export type DepositStage = 'approve' | 'deposit';

export class BuildDepositStageDto {
  @IsIn(['approve', 'deposit'])
  stage!: DepositStage;
}

export class SubmitDepositStageDto {
  @IsIn(['approve', 'deposit'])
  stage!: DepositStage;

  @IsString()
  @MinLength(1)
  xdr!: string;

  @IsString()
  @MinLength(1)
  signature!: string; // hex, with or without 0x prefix
}
