import { cleanup, render, screen } from "@testing-library/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OperatorLayout from "../../layout";
import OperatorDashboardPage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, className, href }: {
    children: React.ReactNode;
    className?: string;
    href: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/useRequireAuth", () => ({
  useRequireAuth: () => ({ isReady: true }),
}));

vi.mock("@/lib/api/me", () => ({
  useMe: () => ({ data: { name: "Operador Teste" } }),
}));

vi.mock("@/components/patterns/AppTopBar", () => ({
  AppTopBar: ({ user }: { user: { name: string } }) => <header>{user.name}</header>,
}));

vi.mock("@/components/primitives/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock("@/components/patterns/MiniKpi", () => ({
  MiniKpi: ({ label, value }: { label: string; value: string }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

vi.mock("@/lib/api/admin", () => ({
  usePendingReceivables: () => ({ data: [], isLoading: false }),
  useApproveReceivable: () => ({ mutateAsync: vi.fn() }),
  useRejectReceivable: () => ({ mutateAsync: vi.fn() }),
  usePendingTransactions: () => ({ data: [], isLoading: false }),
  useApproveTransaction: () => ({ mutateAsync: vi.fn() }),
  useAdminUsers: () => ({ data: [] }),
  useCreateDeposit: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/providers/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("OperatorDashboardPage", () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
    } as ReturnType<typeof useRouter>);
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("tab=pool-status") as ReturnType<typeof useSearchParams>,
    );
  });

  it("shows pool status cards with BRLT balance and contract links", () => {
    render(<OperatorDashboardPage />);

    expect(screen.getByRole("heading", { name: "Situação pool" })).toBeInTheDocument();
    expect(screen.getByText("Token BRLT na pool")).toBeInTheDocument();
    expect(screen.getByText("0 BRLT")).toBeInTheDocument();
    expect(screen.getByText("ID do contrato da Pool")).toBeInTheDocument();
    expect(screen.getByText("CASSTE2CZFG72SBGCPD7YOXCRQC3WSMDS7QHRN6DKVNEZWVJM3EXXXWG")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver Pool no Stellar Expert" })).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/contract/CASSTE2CZFG72SBGCPD7YOXCRQC3WSMDS7QHRN6DKVNEZWVJM3EXXXWG",
    );
    expect(screen.getByRole("link", { name: "Ver BRLT no Stellar Expert" })).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/contract/CCUPQSBG3C4BYYZC6ZUHUFYICHKMNW436MXYFP43UUCP34KXCKNOUVZO",
    );
  });
});

describe("OperatorLayout", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/operator/dashboard");
  });

  it("adds the pool status tab to the operator sidebar", () => {
    render(
      <OperatorLayout>
        <main>Conteúdo</main>
      </OperatorLayout>,
    );

    expect(screen.getByRole("link", { name: "Situação pool" })).toHaveAttribute(
      "href",
      "/operator/dashboard?tab=pool-status",
    );
  });
});
