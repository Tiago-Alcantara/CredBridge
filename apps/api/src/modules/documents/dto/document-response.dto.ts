export interface DocumentResponse {
  id: string;
  type: string;
  url: string;
}

export function toDocumentResponse(d: {
  id: string;
  type: string;
  url: string;
}): DocumentResponse {
  return {
    id: d.id,
    type: d.type,
    url: d.url,
  };
}
