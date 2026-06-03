import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveTransactionDto {
  @IsIn(['APPROVED', 'REJECTED'], { message: 'Status inválido' })
  @IsNotEmpty({ message: 'Status é obrigatório' })
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  pixKey?: string;
}
