import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTokenRole } from "@/lib/api/auth-storage";
import { useMe, useUpdateMe, useUpdatePassword } from "@/lib/api/me";
import { AccountSettings } from "./AccountSettings";

vi.mock("@/lib/api/auth-storage", () => ({
  getTokenRole: vi.fn(),
}));

vi.mock("@/lib/api/me", () => ({
  useMe: vi.fn(),
  useUpdateMe: vi.fn(),
  useUpdatePassword: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  extractApiErrorMessage: vi.fn(() => "Erro"),
}));

vi.mock("@/providers/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/components/primitives/Skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

describe("AccountSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTokenRole).mockReturnValue("pme");
    vi.mocked(useUpdateMe).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateMe>);
    vi.mocked(useUpdatePassword).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdatePassword>);
  });

  it("shows wallet control information from the authenticated user", () => {
    vi.mocked(useMe).mockReturnValue({
      isLoading: false,
      data: {
        id: "user-1",
        email: "owner@empresa.com",
        role: "pme",
        name: null,
        phone: null,
        address: null,
        companyName: null,
        cnpj: null,
        monthlyRevenue: null,
        sector: null,
        investorType: null,
        riskProfile: null,
        operationalLimit: null,
        stellarWalletId: null,
        privyUserId: "did:privy:user-1",
        privyStellarWalletAddress: "GPRIVYWALLET123",
        privyWalletStatus: "ready",
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z",
      },
    } as unknown as ReturnType<typeof useMe>);

    render(<AccountSettings />);

    expect(screen.getByText("Informações da wallet")).toBeInTheDocument();
    expect(screen.getByText("ID do usuário")).toBeInTheDocument();
    expect(screen.getByText("user-1")).toBeInTheDocument();
    expect(screen.getByText("Privy DID")).toBeInTheDocument();
    expect(screen.getByText("did:privy:user-1")).toBeInTheDocument();
    expect(screen.getByText("Wallet Stellar Privy")).toBeInTheDocument();
    expect(screen.getByText("GPRIVYWALLET123")).toBeInTheDocument();
    expect(screen.getByText("Status da wallet")).toBeInTheDocument();
    expect(screen.getByText("Pronta")).toBeInTheDocument();
  });
});
