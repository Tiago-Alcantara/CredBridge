import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUser } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { useGetWallet } from "@/lib/api/wallet";
import { useToast } from "@/providers/ToastProvider";
import { runOnChainDeposit } from "@/lib/stellar/sign-deposit";
import { FinalizeAssignmentModal } from "./FinalizeAssignmentModal";
import type { InvestorTransaction } from "@/lib/api/investments";

vi.mock("@/lib/stellar/sign-deposit", () => ({
  runOnChainDeposit: vi.fn().mockResolvedValue({ depositHash: "REALHASH" }),
}));

vi.mock("@privy-io/react-auth", () => ({
  useUser: vi.fn(),
}));

vi.mock("@privy-io/react-auth/extended-chains", () => ({
  useSignRawHash: vi.fn(),
}));

vi.mock("@/lib/api/wallet", () => ({
  useGetWallet: vi.fn(),
}));

vi.mock("@/providers/ToastProvider", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/components/primitives/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock("@/lib/format", () => ({
  fmtBRL: (value: number) => `R$ ${value.toFixed(2)}`,
}));

const mockTransaction: InvestorTransaction = {
  id: "tx1",
  userId: "user1",
  amount: 500,
  type: "DEPOSIT",
  status: "APPROVED",
  txHash: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("FinalizeAssignmentModal", () => {
  const signRawHash = vi.fn();
  const showToast = vi.fn();
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useUser).mockReturnValue({
      user: {
        linkedAccounts: [
          {
            type: "wallet",
            chainType: "stellar",
            address: "GPRIVYWALLET123",
          },
        ],
      },
    } as unknown as ReturnType<typeof useUser>);

    vi.mocked(useSignRawHash).mockReturnValue({
      signRawHash,
    } as unknown as ReturnType<typeof useSignRawHash>);

    vi.mocked(useGetWallet).mockReturnValue({
      data: {
        contractId: "GPRIVYWALLET123",
        passkeyId: null,
        walletType: "privy_stellar",
        walletStatus: "ready",
      },
    } as unknown as ReturnType<typeof useGetWallet>);

    vi.mocked(useToast).mockReturnValue({ showToast });

    vi.mocked(runOnChainDeposit).mockResolvedValue({ depositHash: "REALHASH" });
  });

  it("runs the real on-chain deposit and shows success (no fabricated hash)", async () => {
    render(
      <FinalizeAssignmentModal
        isOpen
        transaction={mockTransaction}
        onClose={onClose}
        onSuccess={onSuccess}
        userEmail="inv@x.com"
      />,
    );

    fireEvent.click(screen.getByText(/Sign and issue shares/i));

    await waitFor(() =>
      expect(screen.getByText(/CBPOOL shares issued!/i)).toBeInTheDocument(),
    );

    expect(runOnChainDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "tx1",
        privyAddress: "GPRIVYWALLET123",
      }),
    );

    expect(showToast).toHaveBeenCalledWith(
      "CBPOOL shares issued to your wallet successfully!",
      "success",
    );
  });

  it("shows error state when on-chain deposit fails", async () => {
    vi.mocked(runOnChainDeposit).mockRejectedValue(
      new Error("Assinatura rejeitada pelo usuário"),
    );

    render(
      <FinalizeAssignmentModal
        isOpen
        transaction={mockTransaction}
        onClose={onClose}
        onSuccess={onSuccess}
        userEmail="inv@x.com"
      />,
    );

    fireEvent.click(screen.getByText(/Sign and issue shares/i));

    await waitFor(() =>
      expect(screen.getByText(/Signature failed/i)).toBeInTheDocument(),
    );

    expect(screen.getByText(/Assinatura rejeitada pelo usuário/i)).toBeInTheDocument();

    expect(showToast).toHaveBeenCalledWith(
      "On-chain signature via Privy failed.",
      "error",
    );
  });

  it("throws and shows error when Privy wallet address is not found", async () => {
    vi.mocked(useGetWallet).mockReturnValue({
      data: null,
    } as unknown as ReturnType<typeof useGetWallet>);

    vi.mocked(useUser).mockReturnValue({
      user: { linkedAccounts: [] },
    } as unknown as ReturnType<typeof useUser>);

    const { container } = render(
      <FinalizeAssignmentModal
        isOpen
        transaction={mockTransaction}
        onClose={onClose}
        onSuccess={onSuccess}
        userEmail="inv@x.com"
      />,
    );

    const view = within(container);

    fireEvent.click(view.getByText(/Sign and issue shares/i));

    await waitFor(() =>
      expect(view.getByText(/Signature failed/i)).toBeInTheDocument(),
    );

    expect(view.getByText(/Privy Stellar wallet not found/i)).toBeInTheDocument();
    expect(runOnChainDeposit).not.toHaveBeenCalled();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <FinalizeAssignmentModal
        isOpen={false}
        transaction={mockTransaction}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when transaction is null", () => {
    const { container } = render(
      <FinalizeAssignmentModal
        isOpen
        transaction={null}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("calls onSuccess and onClose when the success button is clicked", async () => {
    const { container } = render(
      <FinalizeAssignmentModal
        isOpen
        transaction={mockTransaction}
        onClose={onClose}
        onSuccess={onSuccess}
        userEmail="inv@x.com"
      />,
    );

    const view = within(container);

    fireEvent.click(view.getByText(/Sign and issue shares/i));

    const portfolioButton = await waitFor(() =>
      view.getByRole("button", { name: /View my portfolio/i }),
    );

    fireEvent.click(portfolioButton);

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
