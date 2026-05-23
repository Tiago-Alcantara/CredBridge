import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
import { setAccessToken } from "./auth-storage";
import { exchangePrivySession } from "./privy-session";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("./auth-storage", () => ({
  setAccessToken: vi.fn(),
}));

describe("exchangePrivySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exchanges Privy tokens and stores the internal JWT", async () => {
    const session = {
      accessToken: "internal-jwt",
      needsRoleSelection: true,
      user: {
        id: "user-1",
        email: "owner@empresa.com",
        role: null,
        privyStellarWalletAddress: "GPRIVYWALLET",
      },
    };
    vi.mocked(apiFetch).mockResolvedValue(session);

    await expect(
      exchangePrivySession("privy-access-token", "privy-identity-token"),
    ).resolves.toEqual(session);
    expect(apiFetch).toHaveBeenCalledWith("/auth/privy/session", {
      method: "POST",
      skipAuth: true,
      headers: {
        Authorization: "Bearer privy-access-token",
        "privy-id-token": "privy-identity-token",
      },
    });
    expect(setAccessToken).toHaveBeenCalledWith("internal-jwt");
  });
});
