import { Injectable } from '@nestjs/common';
import { DocumentsRepository } from './documents.repository';
import { CreateDocumentDto } from './dto/create-document.dto';
import { toDocumentResponse } from './dto/document-response.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly repo: DocumentsRepository) {}

  async create(data: CreateDocumentDto) {
    return toDocumentResponse(await this.repo.create(data));
  }

  async findByReceivable(receivableId: string) {
    return (await this.repo.findByReceivable(receivableId)).map(toDocumentResponse);
  }
}
