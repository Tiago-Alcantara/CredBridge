import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AnchorService } from './anchor.service';
import { GetQuoteDto } from './dto/get-quote.dto';
import { StartRampDto } from './dto/start-ramp.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { userId: string };
}

@Controller('anchor')
@UseGuards(JwtAuthGuard)
export class AnchorController {
  constructor(private readonly anchorService: AnchorService) {}

  /** GET /v1/anchor/onboarding-status — checks if customer has completed KYC; returns kycUrl if not */
  @Get('onboarding-status')
  getOnboardingStatus(@Req() req: AuthRequest) {
    return this.anchorService.getOnboardingStatus(req.user.userId);
  }

  /** POST /v1/anchor/onramp/quote — SEP-38 quote: BRL → TESOURO */
  @Post('onramp/quote')
  getOnrampQuote(@Body() dto: GetQuoteDto, @Req() req: AuthRequest) {
    return this.anchorService.getOnrampQuote(req.user.userId, dto.amount);
  }

  /** POST /v1/anchor/onramp/start — SEP-24 interactive deposit; returns interactiveUrl */
  @Post('onramp/start')
  startOnramp(@Body() dto: StartRampDto, @Req() req: AuthRequest) {
    return this.anchorService.startOnramp(req.user.userId, dto.amount, dto.quoteId);
  }

  /** POST /v1/anchor/offramp/quote — SEP-38 quote: TESOURO → BRL */
  @Post('offramp/quote')
  getOfframpQuote(@Body() dto: GetQuoteDto, @Req() req: AuthRequest) {
    return this.anchorService.getOfframpQuote(req.user.userId, dto.amount);
  }

  /** POST /v1/anchor/offramp/start — SEP-24 interactive withdrawal; returns interactiveUrl */
  @Post('offramp/start')
  startOfframp(@Body() dto: StartRampDto, @Req() req: AuthRequest) {
    return this.anchorService.startOfframp(req.user.userId, dto.amount, dto.quoteId);
  }
}
