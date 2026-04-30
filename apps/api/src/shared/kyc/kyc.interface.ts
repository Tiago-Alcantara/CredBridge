export type KycStatus = 'approved' | 'rejected' | 'pending';

export interface KycVerificationResult {
  status: KycStatus;
  reason?: string;
  verifiedAt?: string;
}

export interface KycService {
  verifyCpf(cpf: string, name: string): Promise<KycVerificationResult>;
  verifyCnpj(cnpj: string, companyName: string): Promise<KycVerificationResult>;
}

export const KYC_SERVICE = Symbol('KYC_SERVICE');
