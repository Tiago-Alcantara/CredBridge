import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ReceivablesService } from './receivables.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string | null };
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

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.receivablesService.activate(id);
  }

  @Patch(':id/tokenize')
  tokenize(@Param('id') id: string) {
    return this.receivablesService.tokenize(id);
  }

  @Patch(':id/request-assignment')
  requestAssignment(@Param('id') id: string) {
    return this.receivablesService.requestAssignment(id);
  }

  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() body: { authorizationId: string }) {
    return this.receivablesService.assign(id, body.authorizationId);
  }
}
