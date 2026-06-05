import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateDepositDto {
  @IsString({ message: 'O ID do usuário investidor deve ser texto' })
  @IsNotEmpty({ message: 'O ID do usuário investidor é obrigatório' })
  userId: string;

  @IsNumber({}, { message: 'O valor do depósito deve ser um número' })
  @Min(1, { message: 'O valor do depósito deve ser de pelo menos R$ 1,00' })
  @IsNotEmpty({ message: 'O valor do depósito é obrigatório' })
  amount: number;
}
