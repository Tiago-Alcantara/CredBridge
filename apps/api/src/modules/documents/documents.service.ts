import { Injectable } from '@nestjs/common';
import { DocumentsRepository } from './documents.repository';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly repo: DocumentsRepository) {}

  async create(data: CreateDocumentDto) {
    return this.repo.create(data);
  }

  async findByReceivable(receivableId: string) {
    return this.repo.findByReceivable(receivableId);
  }
}
