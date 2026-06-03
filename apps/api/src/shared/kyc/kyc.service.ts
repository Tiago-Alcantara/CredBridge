import { Injectable, Logger } from '@nestjs/common';
import { KycService, KycVerificationResult } from './kyc.interface';

@Injectable()
export class KycProviderService implements KycService {
  private readonly logger = new Logger(KycProviderService.name);

  async verifyCpf(cpf: string, name: string): Promise<KycVerificationResult> {
    this.logger.log(`verifyCpf called for CPF ending in: ${cpf.slice(-4)}`);
    // TODO: implement KYC provider integration
    return { status: 'approved', verifiedAt: new Date().toISOString() };
  }

  async verifyCnpj(
    cnpj: string,
    companyName: string,
  ): Promise<KycVerificationResult> {
    this.logger.log(`verifyCnpj called for CNPJ ending in: ${cnpj.slice(-4)}`);
    // TODO: implement KYC provider integration
    return { status: 'approved', verifiedAt: new Date().toISOString() };
  }
}
