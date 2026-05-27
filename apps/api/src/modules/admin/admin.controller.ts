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
import { AdminService } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ApproveTransactionDto } from './dto/approve-transaction.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string | null };
}

function assertOperator(req: AuthRequest) {
  if (req.user.role !== 'operator') {
    throw new ForbiddenException(
      'Apenas operadores da plataforma podem acessar este recurso',
    );
  }
}

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Post('users')
  createUser(@Req() req: AuthRequest, @Body() body: CreateUserDto) {
    assertOperator(req);
    return this.service.createUser(body);
  }

  @Get('users')
  listUsers(@Req() req: AuthRequest) {
    assertOperator(req);
    return this.service.listUsers();
  }

  @Get('receivables/pending')
  listPendingReceivables(@Req() req: AuthRequest) {
    assertOperator(req);
    return this.service.listPendingReceivables();
  }

  @Patch('receivables/:id/approve')
  approveReceivable(@Req() req: AuthRequest, @Param('id') id: string) {
    assertOperator(req);
    return this.service.approveReceivable(id, req.user.userId);
  }

  @Patch('receivables/:id/reject')
  rejectReceivable(@Req() req: AuthRequest, @Param('id') id: string) {
    assertOperator(req);
    return this.service.rejectReceivable(id, req.user.userId);
  }

  @Get('transactions/pending')
  listPendingTransactions(@Req() req: AuthRequest) {
    assertOperator(req);
    return this.service.listPendingTransactions();
  }

  @Post('transactions/:id/approve')
  approveTransaction(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: ApproveTransactionDto,
  ) {
    assertOperator(req);
    return this.service.approveTransaction(id, req.user.userId, body.status);
  }
}
