import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateNestedDocumentDto } from './dto/create-nested-document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('receivables/:receivableId/documents')
  create(
    @Param('receivableId') receivableId: string,
    @Body() body: CreateNestedDocumentDto,
  ) {
    return this.documentsService.create({ ...body, receivableId });
  }

  @Get('receivables/:receivableId/documents')
  findByReceivable(@Param('receivableId') receivableId: string) {
    return this.documentsService.findByReceivable(receivableId);
  }
}
