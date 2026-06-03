"use client";

import { useCallback, useRef, useState } from "react";
import { useIdentityToken, usePrivy, useUser } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";
import {
  exchangePrivySession,
  type PrivySessionResponse,
} from "@/lib/api/privy-session";

interface LinkedAccount {
  type?: string;
  address?: string;
  chainType?: string;
  chain_type?: string;
}

function hasStellarWallet(linkedAccounts: LinkedAccount[] | undefined): boolean {
  return (
    linkedAccounts?.some(
      (linkedAccount) =>
        linkedAccount.type === "wallet" &&
        (linkedAccount.chainType === "stellar" ||
          linkedAccount.chain_type === "stellar") &&
        typeof linkedAccount.address === "string",
    ) ?? false
  );
}

export function usePrivySessionBootstrap() {
  const { getAccessToken } = usePrivy();
  const { user } = useUser();
  const { identityToken } = useIdentityToken();
  const { createWallet } = useCreateWallet();
  const isRunningRef = useRef(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bootstrapSession = useCallback(async (): Promise<PrivySessionResponse> => {
    if (isRunningRef.current) {
      throw new Error("Privy session bootstrap is already running");
    }

    isRunningRef.current = true;
    setIsBootstrapping(true);
    setError(null);

    try {
      if (!identityToken) {
        throw new Error(
          "Token de identidade Privy indisponivel. Ative identity tokens no dashboard da Privy ou aguarde e tente novamente.",
        );
      }

      if (!hasStellarWallet(user?.linkedAccounts as LinkedAccount[] | undefined)) {
        await createWallet({ chainType: "stellar" });
      }

      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("A Privy nao forneceu o token de acesso. Faca login novamente.");
      }

      return await exchangePrivySession(accessToken, identityToken);
    } catch (bootstrapError) {
      const errorMessage =
        bootstrapError instanceof Error
          ? bootstrapError.message
          : "Nao foi possivel iniciar sua sessao.";
      setError(errorMessage);
      throw bootstrapError;
    } finally {
      isRunningRef.current = false;
      setIsBootstrapping(false);
    }
  }, [createWallet, getAccessToken, identityToken, user]);

  return {
    bootstrapSession,
    canBootstrapSession: Boolean(identityToken),
    isBootstrapping,
    error,
  };
}
