import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface ReceivableCollection {
  id: string;
  receivableId: string;
  pixOrderId: string | null;
  identifier: string | null;
  amount: number;
  dueDate: string;
  status: string;
  txHash: string | null;
  endToEndId: string | null;
  pixQrCodePayload: string | null;
  pixQrCodeLocation: string | null;
  pixQrCodeBase64: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  debtorName: string;
  debtorDocument: string;
}

export const collectionsQueryKeys = {
  active: ["collections", "active"] as const,
};

export function useActiveCollections() {
  return useQuery<ReceivableCollection[]>({
    queryKey: collectionsQueryKeys.active,
    queryFn: () => apiFetch<ReceivableCollection[]>("/pix/collections/active"),
  });
}
