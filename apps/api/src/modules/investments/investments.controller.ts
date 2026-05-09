import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string };
}

function assertInvestor(req: AuthRequest) {
  if (req.user.role !== 'investor') {
    throw new ForbiddenException('Apenas investidores podem acessar este recurso');
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
}
