import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ReceivablesService } from './receivables.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';

@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Post()
  create(@Body() body: CreateReceivableDto) {
    return this.receivablesService.create(body);
  }

  @Get()
  findAll() {
    return this.receivablesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receivablesService.findOne(id);
  }
}
