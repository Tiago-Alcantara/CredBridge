import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMe } from "@/lib/api/me";
import { useCreateWallet, useGetWallet } from "@/lib/api/wallet";
import { WalletSetupBanner } from "./WalletSetupBanner";

vi.mock("@/components/primitives/Icon", () => ({
  Icon: () => null,
}));

vi.mock("@/lib/api/me", () => ({
  useMe: vi.fn(),
}));

vi.mock("@/lib/api/wallet", () => ({
  useCreateWallet: vi.fn(),
  useGetWallet: vi.fn(),
}));

describe("WalletSetupBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(useGetWallet).mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useGetWallet>);
    vi.mocked(useMe).mockReturnValue({
      data: { email: "owner@empresa.com" },
    } as unknown as ReturnType<typeof useMe>);
    vi.mocked(useCreateWallet).mockReturnValue({
      mutateAsync: vi.fn(),
    } as unknown as ReturnType<typeof useCreateWallet>);
  });

  it("describes legacy setup as advanced financial signing", () => {
    render(<WalletSetupBanner />);

    expect(
      screen.getByText(
        "Assinatura avançada para operações financeiras ainda não configurada.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Configurar assinatura" }),
    ).toBeInTheDocument();
  });
});
