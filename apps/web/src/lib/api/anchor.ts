import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

interface StartRampInput {
  amount: number;
  quoteId?: string;
}

export interface PaymentInstructions {
  type: "pix" | "spei";
  pixCode?: string;
  pixKey?: string;
  pixKeyType?: string;
  clabe?: string;
  bankName?: string;
  beneficiary?: string;
  amount: string;
  currency: string;
}

export interface StartRampResponse {
  id: string;
  status: string;
  paymentInstructions?: PaymentInstructions;
}

export interface OnboardingStatusResponse {
  onboarded: boolean;
  kycUrl: string;
}

export function useAnchorOnboardingStatus(polling: boolean) {
  return useQuery({
    queryKey: ["anchor", "onboarding-status"],
    queryFn: () =>
      apiFetch<OnboardingStatusResponse>("/anchor/onboarding-status"),
    enabled: polling,
    refetchInterval: polling ? 3000 : false,
    staleTime: 0,
  });
}

export function useAnchorOnrampStart() {
  return useMutation({
    mutationFn: (input: StartRampInput) =>
      apiFetch<StartRampResponse>("/anchor/onramp/start", {
        method: "POST",
        body: input,
      }),
  });
}

export function useAnchorOfframpStart() {
  return useMutation({
    mutationFn: (input: StartRampInput) =>
      apiFetch<StartRampResponse>("/anchor/offramp/start", {
        method: "POST",
        body: input,
      }),
  });
}
