import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string | null };
}

function assertInvestor(req: AuthRequest) {
  if (req.user.role !== 'investor') {
    throw new ForbiddenException(
      'Apenas investidores podem acessar este recurso',
    );
  }
}

@UseGuards(JwtAuthGuard)
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly service: InvestmentsService) {}

  @Post()
  create(@Req() req: AuthRequest, @Body() body: CreateInvestmentDto) {
    assertInvestor(req);
    return this.service.create(req.user.userId, body);
  }

  @Get('me')
  findMine(@Req() req: AuthRequest) {
    assertInvestor(req);
    return this.service.findMine(req.user.userId);
  }

  @Get('me/stats')
  getMyStats(@Req() req: AuthRequest) {
    assertInvestor(req);
    return this.service.getMyStats(req.user.userId);
  }

  @Get('me/transactions')
  findMyTransactions(@Req() req: AuthRequest) {
    assertInvestor(req);
    return this.service.findMyTransactions(req.user.userId);
  }

  @Patch('deposit/:id/pay')
  markAsPaid(@Req() req: AuthRequest, @Param('id') id: string) {
    assertInvestor(req);
    return this.service.markAsPaid(id, req.user.userId);
  }

  @Post('deposit/:id/finalize')
  finalizeDeposit(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body('txHash') txHash: string,
  ) {
    assertInvestor(req);
    return this.service.finalizeDeposit(id, req.user.userId, txHash);
  }
}
