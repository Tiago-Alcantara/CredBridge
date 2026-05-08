export interface Investor {
  id: string;
  name: string;
  cnpj?: string;
  cpf?: string;
  stellarAddress?: string;
  createdAt: string;
}

export interface InvestorPoolStats {
  totalValue: number;
  activeCount: number;
  validatedCount: number;
  poolCount: number;
}
