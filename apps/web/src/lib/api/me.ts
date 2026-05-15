import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface MeResponse {
  id: string;
  email: string;
  role: string | null;
  name: string | null;
  phone: string | null;
  address: string | null;
  companyName: string | null;
  cnpj: string | null;
  monthlyRevenue: number | null;
  sector: string | null;
  investorType: string | null;
  riskProfile: string | null;
  operationalLimit: number | null;
  stellarWalletId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  address?: string;
  companyName?: string;
  cnpj?: string;
  monthlyRevenue?: number;
  sector?: string;
  investorType?: string;
  riskProfile?: string;
  operationalLimit?: number;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/auth/me"),
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiFetch<MeResponse>("/auth/me", { method: "PATCH", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiFetch<{ message: string }>("/auth/me/password", {
        method: "PATCH",
        body: input,
      }),
  });
}
