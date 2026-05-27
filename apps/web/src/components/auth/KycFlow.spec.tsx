import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateProfile } from "@/lib/api/auth";
import { useMe } from "@/lib/api/me";
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

describe("KycFlow", () => {
  const updateProfile = vi.fn();
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
    updateProfile.mockResolvedValue({});
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
  });
});
