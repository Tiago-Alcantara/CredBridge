import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const SECTORS = [
  'tecnologia',
  'varejo',
  'industria',
  'servicos',
  'agronegocio',
  'saude',
  'construcao',
  'transporte',
  'educacao',
  'financeiro',
] as const;
const INVESTOR_TYPES = ['pf', 'pj'] as const;
const RISK_PROFILES = ['conservador', 'moderado', 'arrojado'] as const;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyRevenue?: number;

  @IsOptional()
  @IsIn(SECTORS)
  sector?: string;

  @IsOptional()
  @IsIn(INVESTOR_TYPES)
  investorType?: string;

  @IsOptional()
  @IsIn(RISK_PROFILES)
  riskProfile?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  operationalLimit?: number;
}
