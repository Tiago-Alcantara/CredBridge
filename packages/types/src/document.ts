export type DocumentType = 'invoice' | 'contract' | 'duplicate' | 'kyc';

export interface Document {
  id: string;
  receivableId: string;
  url: string;
  hash: string;
  type: DocumentType;
  uploadedAt: string;
}

export interface UploadDocumentInput {
  receivableId: string;
  type: DocumentType;
  file: Buffer;
  filename: string;
}
