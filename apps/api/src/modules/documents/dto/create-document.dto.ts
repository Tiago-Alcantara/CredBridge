import { DocumentType } from '@credbridge/types';

export class CreateDocumentDto {
  receivableId!: string;
  type!: DocumentType;
  url!: string;
  hash!: string;
}
