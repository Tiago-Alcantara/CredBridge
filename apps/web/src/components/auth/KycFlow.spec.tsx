import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateProfile } from "@/lib/api/auth";
import { useMe } from "@/lib/api/me";
import { useCreateWallet } from "@/lib/api/wallet";
import { registerAndDeployWallet } from "@/lib/wallet/passkey-client";
import { KycFlow } from "./KycFlow";

vi.mock("@/components/primitives/Icon", () => ({
  Icon: () => null,
}));

vi.mock("@/lib/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/api/auth", () => ({
  useUpdateProfile: vi.fn(),
}));

vi.mock("@/lib/api/me", () => ({
  useMe: vi.fn(),
}));

vi.mock("@/lib/api/wallet", () => ({
  useCreateWallet: vi.fn(),
}));

vi.mock("@/lib/wallet/passkey-client", () => ({
  registerAndDeployWallet: vi.fn(),
  PasskeyAbortedError: class PasskeyAbortedError extends Error {},
}));

describe("KycFlow", () => {
  const updateProfile = vi.fn();
  const createWallet = vi.fn();
  const onDone = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutateAsync: updateProfile,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateProfile>);
    vi.mocked(useMe).mockReturnValue({
      data: { email: "owner@empresa.com" },
    } as unknown as ReturnType<typeof useMe>);
    vi.mocked(useCreateWallet).mockReturnValue({
      mutateAsync: createWallet,
    } as unknown as ReturnType<typeof useCreateWallet>);
    vi.mocked(registerAndDeployWallet).mockResolvedValue({
      contractId: "CLEGACY",
      keyId: "passkey-id",
      publicKey: "passkey-public-key",
    });
    updateProfile.mockResolvedValue({});
    createWallet.mockResolvedValue({});
  });

  it("finishes KYC without provisioning the legacy smart account", async () => {
    const user = userEvent.setup();
    render(<KycFlow onDone={onDone} />);

    await user.click(screen.getByRole("button", { name: /continuar/i }));
    await user.click(screen.getByRole("button", { name: /continuar/i }));
    await user.click(screen.getByRole("button", { name: /continuar/i }));
    await user.click(screen.getByRole("button", { name: /ir para painel/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(updateProfile).toHaveBeenCalledOnce();
    expect(registerAndDeployWallet).not.toHaveBeenCalled();
    expect(createWallet).not.toHaveBeenCalled();
  });
});
