import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ReceivablesService } from './receivables.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Post()
  create(@Req() req: AuthRequest, @Body() body: CreateReceivableDto) {
    return this.receivablesService.create(req.user.userId, body);
  }

  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.receivablesService.findAll(req.user.userId);
  }

  @Get('pool/stats')
  getPoolStats() {
    return this.receivablesService.getPoolStats();
  }

  @Get('pool')
  findPool() {
    return this.receivablesService.findPool();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receivablesService.findOne(id);
  }
}
