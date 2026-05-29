import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StellarWalletService } from './stellar-wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';

interface AuthRequest {
  user: { userId: string };
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class StellarWalletController {
  constructor(private readonly walletService: StellarWalletService) {}

  @Post('create')
  create(@Req() req: AuthRequest, @Body() body: CreateWalletDto) {
    return this.walletService.createWallet(req.user.userId, body);
  }

  @Get()
  get(@Req() req: AuthRequest) {
    return this.walletService.getWallet(req.user.userId);
  }
}
