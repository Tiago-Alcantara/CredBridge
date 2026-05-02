export type DocumentType = 'invoice' | 'contract' | 'duplicate' | 'kyc';

export interface Document {
  id: string;
  receivableId: string;
  url: string;
  hash: string;
  type: DocumentType;
  createdAt: string;
}

export interface UploadDocumentInput {
  receivableId: string;
  type: DocumentType;
  file: Buffer;
  filename: string;
}

export interface RegisterDocumentInput {
  receivableId: string;
  type: DocumentType;
  url: string;
  hash: string;
}
