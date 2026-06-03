import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'E-mail é obrigatório' })
  email: string;

  @IsIn(['pme', 'investor'], { message: 'Função deve ser pme ou investor' })
  @IsNotEmpty({ message: 'Função é obrigatória' })
  role: 'pme' | 'investor';

  @IsString({ message: 'Nome deve ser texto' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsNumber()
  monthlyRevenue?: number;

  @IsOptional()
  @IsString()
  riskProfile?: string;

  @IsOptional()
  @IsNumber()
  operationalLimit?: number;
}
