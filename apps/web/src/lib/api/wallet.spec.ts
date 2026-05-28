import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
import { fetchWalletXlmBalance } from "./wallet";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

describe("wallet api", () => {
  it("fetches the native XLM balance from the dedicated wallet endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      walletAddress: "GPRIVYWALLET",
      xlmBalance: 4.25,
    });

    const result = await fetchWalletXlmBalance();

    expect(apiFetch).toHaveBeenCalledWith("/wallet/xlm-balance");
    expect(result).toEqual({
      walletAddress: "GPRIVYWALLET",
      xlmBalance: 4.25,
    });
  });
});
