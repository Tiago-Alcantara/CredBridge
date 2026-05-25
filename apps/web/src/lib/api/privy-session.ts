import { apiFetch } from "./client";
import { setAccessToken } from "./auth-storage";

export interface PrivySessionUser {
  id: string;
  email: string;
  role: "pme" | "investor" | null;
  privyStellarWalletAddress: string | null;
  privyWalletStatus: string | null;
}

export interface PrivySessionResponse {
  accessToken: string;
  user: PrivySessionUser;
  needsRoleSelection: boolean;
}

export async function exchangePrivySession(
  accessToken: string,
  identityToken: string,
): Promise<PrivySessionResponse> {
  const session = await apiFetch<PrivySessionResponse>("/auth/privy/session", {
    method: "POST",
    skipAuth: true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "privy-id-token": identityToken,
    },
  });

  setAccessToken(session.accessToken);
  return session;
}
