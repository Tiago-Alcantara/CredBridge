import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  find(@Req() req: AuthRequest, @Query('entityId') entityId?: string) {
    if (entityId) {
      return this.auditService.findByEntity(entityId);
    }
    return this.auditService.findByUser(req.user.userId);
  }
}
