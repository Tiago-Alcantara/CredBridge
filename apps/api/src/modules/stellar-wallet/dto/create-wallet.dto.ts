import { IsString, IsNotEmpty } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  contractId!: string;

  @IsString()
  @IsNotEmpty()
  keyId!: string;
}
