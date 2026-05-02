import { Controller, Get, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findByEntity(@Query('entityId') entityId: string) {
    if (!entityId) {
      throw new BadRequestException('entityId is required');
    }
    return this.auditService.findByEntity(entityId);
  }
}
