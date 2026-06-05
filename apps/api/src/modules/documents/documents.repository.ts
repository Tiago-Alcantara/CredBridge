import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDocumentDto) {
    const document = await this.prisma.document.create({ data });

    if (data.type === 'invoice') {
      await this.prisma.receivable.update({
        where: { id: data.receivableId },
        data: { documentHash: data.hash },
      });
    }

    return document;
  }

  async findByReceivable(receivableId: string) {
    return this.prisma.document.findMany({ where: { receivableId } });
  }
}
