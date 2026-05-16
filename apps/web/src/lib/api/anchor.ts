import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "./client";

interface StartRampInput {
  amount: number;
  quoteId?: string;
}

export interface StartRampResponse {
  id: string;
  interactiveUrl?: string;
  status: string;
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

