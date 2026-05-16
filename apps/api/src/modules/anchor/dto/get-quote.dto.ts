import { IsNumber, IsPositive, IsIn } from 'class-validator';

export class GetQuoteDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsIn(['BRL', 'TESOURO'])
  fromCurrency!: 'BRL' | 'TESOURO';

  @IsIn(['BRL', 'TESOURO'])
  toCurrency!: 'BRL' | 'TESOURO';
}
