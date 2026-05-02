import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post()
  create(@Body() body: CreateSettlementDto) {
    return this.settlementsService.create(body);
  }

  @Get()
  findAll() {
    return this.settlementsService.findAll();
  }

  @Get('receivable/:receivableId')
  findByReceivable(@Param('receivableId') receivableId: string) {
    return this.settlementsService.findByReceivable(receivableId);
  }
}
