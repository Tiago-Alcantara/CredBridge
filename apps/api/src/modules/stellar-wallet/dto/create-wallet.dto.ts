import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^C[A-Z0-9]+$/)
  contractId!: string;

  @IsString()
  @IsNotEmpty()
  keyId!: string;

  @IsString()
  @IsNotEmpty()
  publicKey!: string;
}
