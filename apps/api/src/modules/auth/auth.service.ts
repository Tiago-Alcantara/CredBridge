import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async getStellarChallenge(stellarAddress: string): Promise<{ challenge: string }> {
    this.logger.log(`getStellarChallenge for: ${stellarAddress}`);
    // TODO: implement SEP-10 challenge generation
    return { challenge: `challenge-${Date.now()}` };
  }

  async verifyStellarChallenge(signedTransaction: string): Promise<{ token: string }> {
    this.logger.log('verifyStellarChallenge called');
    // TODO: implement SEP-10 verification and JWT issuance
    return { token: `jwt-${Date.now()}` };
  }
}
