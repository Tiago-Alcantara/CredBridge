import { act, renderHook } from "@testing-library/react";
import { useUser } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateFinancialAuthorizationChallenge,
  useVerifyFinancialAuthorization,
} from "@/lib/api/financial-authorizations";
import { useGetWallet } from "@/lib/api/wallet";
import { useFinancialAuthorization } from "./useFinancialAuthorization";

vi.mock("@privy-io/react-auth", () => ({
  useUser: vi.fn(),
}));

vi.mock("@privy-io/react-auth/extended-chains", () => ({
  useSignRawHash: vi.fn(),
}));

vi.mock("@/lib/api/wallet", () => ({
  useGetWallet: vi.fn(),
}));

vi.mock("@/lib/api/financial-authorizations", () => ({
  useCreateFinancialAuthorizationChallenge: vi.fn(),
  useVerifyFinancialAuthorization: vi.fn(),
}));

describe("useFinancialAuthorization", () => {
  const refetchWallet = vi.fn();
  const signRawHash = vi.fn();
  const createChallenge = vi.fn();
  const verifyAuthorization = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUser).mockReturnValue({
      user: {
        linkedAccounts: [
          {
            type: "wallet",
            chainType: "stellar",
            address: "GPRIVYWALLET",
          },
        ],
      },
    } as unknown as ReturnType<typeof useUser>);
    vi.mocked(useSignRawHash).mockReturnValue({
      signRawHash,
    } as unknown as ReturnType<typeof useSignRawHash>);
    vi.mocked(useGetWallet).mockReturnValue({
      data: {
        contractId: "GPRIVYWALLET",
        passkeyId: null,
        walletType: "privy_stellar",
        walletStatus: "ready",
      },
      refetch: refetchWallet,
    } as unknown as ReturnType<typeof useGetWallet>);
    vi.mocked(useCreateFinancialAuthorizationChallenge).mockReturnValue({
      mutateAsync: createChallenge,
    } as unknown as ReturnType<typeof useCreateFinancialAuthorizationChallenge>);
    vi.mocked(useVerifyFinancialAuthorization).mockReturnValue({
      mutateAsync: verifyAuthorization,
    } as unknown as ReturnType<typeof useVerifyFinancialAuthorization>);

    createChallenge.mockResolvedValue({
      authorizationId: "auth-1",
      payloadHash: "a".repeat(64),
    });
    signRawHash.mockResolvedValue({ signature: "0xsigned" });
    verifyAuthorization.mockResolvedValue({ authorizationId: "auth-1" });
  });

  it("signs financial authorization challenges with the Privy Stellar wallet", async () => {
    const { result } = renderHook(() => useFinancialAuthorization());

    let authorizationId = "";
    await act(async () => {
      authorizationId = await result.current.authorize({
        operation: "investment.purchase",
        resourceId: "rec-1",
        amount: "970.00",
      });
    });

    expect(authorizationId).toBe("auth-1");
    expect(signRawHash).toHaveBeenCalledWith({
      address: "GPRIVYWALLET",
      chainType: "stellar",
      hash: `0x${"a".repeat(64)}`,
    });
    expect(verifyAuthorization).toHaveBeenCalledWith({
      authorizationId: "auth-1",
      payloadHash: "a".repeat(64),
      assertion: {
        type: "privy_raw_hash",
        address: "GPRIVYWALLET",
        signature: "0xsigned",
      },
    });
    expect(refetchWallet).not.toHaveBeenCalled();
  });

  it("fails clearly when the Privy Stellar wallet is missing", async () => {
    vi.mocked(useUser).mockReturnValue({
      user: { linkedAccounts: [] },
    } as unknown as ReturnType<typeof useUser>);
    vi.mocked(useGetWallet).mockReturnValue({
      data: null,
      refetch: refetchWallet,
    } as unknown as ReturnType<typeof useGetWallet>);

    const { result } = renderHook(() => useFinancialAuthorization());

    await act(async () => {
      await expect(
        result.current.authorize({
          operation: "investment.purchase",
          resourceId: "rec-1",
          amount: "970.00",
        }),
      ).rejects.toThrow("Privy Stellar wallet is required for financial authorization");
    });

    expect(createChallenge).not.toHaveBeenCalled();
    expect(signRawHash).not.toHaveBeenCalled();
  });
});
