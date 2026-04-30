import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('stellar/challenge')
  getStellarChallenge(@Body() body: { stellarAddress: string }) {
    return this.authService.getStellarChallenge(body.stellarAddress);
  }

  @Post('stellar/verify')
  verifyStellarChallenge(@Body() body: { signedTransaction: string }) {
    return this.authService.verifyStellarChallenge(body.signedTransaction);
  }
}
