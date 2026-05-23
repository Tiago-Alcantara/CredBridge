import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFinancialAuthorizationChallengeDto } from './dto/create-financial-authorization-challenge.dto';
import { VerifyFinancialAuthorizationDto } from './dto/verify-financial-authorization.dto';
import { FinancialAuthorizationsService } from './financial-authorizations.service';

interface AuthRequest {
  user: { userId: string };
}

@Controller('financial-authorizations')
@UseGuards(JwtAuthGuard)
export class FinancialAuthorizationsController {
  constructor(private readonly service: FinancialAuthorizationsService) {}

  @Post('challenge')
  createChallenge(
    @Req() req: AuthRequest,
    @Body() body: CreateFinancialAuthorizationChallengeDto,
  ) {
    return this.service.createChallenge(req.user.userId, body);
  }

  @Post('verify')
  verify(
    @Req() req: AuthRequest,
    @Body() body: VerifyFinancialAuthorizationDto,
  ) {
    return this.service.verify(req.user.userId, body);
  }
}
