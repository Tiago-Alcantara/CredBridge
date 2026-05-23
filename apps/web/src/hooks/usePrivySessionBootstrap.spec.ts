import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getIdentityToken,
  useIdentityToken,
  usePrivy,
  useUser,
} from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";
import { exchangePrivySession } from "@/lib/api/privy-session";
import { usePrivySessionBootstrap } from "./usePrivySessionBootstrap";

vi.mock("@privy-io/react-auth", () => ({
  getIdentityToken: vi.fn(),
  useIdentityToken: vi.fn(),
  usePrivy: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock("@privy-io/react-auth/extended-chains", () => ({
  useCreateWallet: vi.fn(),
}));

vi.mock("@/lib/api/privy-session", () => ({
  exchangePrivySession: vi.fn(),
}));

describe("usePrivySessionBootstrap", () => {
  const getAccessToken = vi.fn();
  const refreshUser = vi.fn();
  const createWallet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePrivy).mockReturnValue({
      getAccessToken,
    } as unknown as ReturnType<typeof usePrivy>);
    vi.mocked(useUser).mockReturnValue({
      user: { linkedAccounts: [] },
      refreshUser,
    } as unknown as ReturnType<typeof useUser>);
    vi.mocked(useIdentityToken).mockReturnValue({
      identityToken: "privy-identity-token",
    });
    vi.mocked(useCreateWallet).mockReturnValue({
      createWallet,
    } as ReturnType<typeof useCreateWallet>);
    getAccessToken.mockResolvedValue("privy-access-token");
    vi.mocked(getIdentityToken).mockResolvedValue("privy-identity-token");
    vi.mocked(exchangePrivySession).mockResolvedValue({
      accessToken: "internal-jwt",
      needsRoleSelection: true,
      user: {
        id: "user-1",
        email: "owner@empresa.com",
        role: null,
        privyStellarWalletAddress: "GPRIVYWALLET",
      },
    });
  });

  it("creates a Stellar wallet before exchanging a session when none exists", async () => {
    const { result } = renderHook(() => usePrivySessionBootstrap());

    await act(async () => {
      await result.current.bootstrapSession();
    });

    expect(createWallet).toHaveBeenCalledWith({ chainType: "stellar" });
    expect(refreshUser).not.toHaveBeenCalled();
    expect(getIdentityToken).not.toHaveBeenCalled();
    expect(exchangePrivySession).toHaveBeenCalledWith(
      "privy-access-token",
      "privy-identity-token",
    );
    expect(createWallet.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(exchangePrivySession).mock.invocationCallOrder[0],
    );
  });

  it("does not create another Stellar wallet for an already provisioned user", async () => {
    vi.mocked(useUser).mockReturnValue({
      user: {
        linkedAccounts: [{ type: "wallet", chainType: "stellar", address: "GEXISTING" }],
      },
      refreshUser,
    } as unknown as ReturnType<typeof useUser>);
    const { result } = renderHook(() => usePrivySessionBootstrap());

    await act(async () => {
      await result.current.bootstrapSession();
    });

    expect(createWallet).not.toHaveBeenCalled();
    expect(getIdentityToken).not.toHaveBeenCalled();
    expect(exchangePrivySession).toHaveBeenCalledWith(
      "privy-access-token",
      "privy-identity-token",
    );
  });

  it("explains missing identity tokens without provisioning a wallet or requesting a session", async () => {
    vi.mocked(useIdentityToken).mockReturnValue({
      identityToken: null,
    });
    const { result } = renderHook(() => usePrivySessionBootstrap());

    await act(async () => {
      await expect(result.current.bootstrapSession()).rejects.toThrow(
        "Token de identidade Privy indisponivel. Ative identity tokens no dashboard da Privy ou aguarde e tente novamente.",
      );
    });

    expect(createWallet).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(exchangePrivySession).not.toHaveBeenCalled();
  });
});
