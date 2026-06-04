import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDocumentDto) {
    return this.prisma.document.create({ data });
  }

  async findByReceivable(receivableId: string) {
    return this.prisma.document.findMany({ where: { receivableId } });
  }
}
