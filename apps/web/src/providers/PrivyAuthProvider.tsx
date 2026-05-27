"use client";

import { PrivyProvider } from "@privy-io/react-auth";

interface PrivyAuthProviderProps {
  children: React.ReactNode;
}

export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID must be configured");
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        loginMethods: ["email", "google"],
        embeddedWallets: {
          showWalletUIs: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
