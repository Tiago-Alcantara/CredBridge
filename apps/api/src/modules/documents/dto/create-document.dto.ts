import { IsIn, IsString, IsUrl, MinLength } from 'class-validator';
import type { DocumentType } from '@credbridge/types';

const DOCUMENT_TYPES: DocumentType[] = [
  'invoice',
  'contract',
  'duplicate',
  'kyc',
];

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  receivableId!: string;

  @IsIn(DOCUMENT_TYPES)
  type!: DocumentType;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsString()
  @MinLength(1)
  hash!: string;
}
