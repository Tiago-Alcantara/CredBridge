import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { usePrivySessionBootstrap } from "@/hooks/usePrivySessionBootstrap";
import { clearInternalSession } from "@/lib/api/auth-storage";
import { PrivyLoginPanel } from "./PrivyLoginPanel";

vi.mock("@privy-io/react-auth", () => ({
  useLogin: vi.fn(),
  usePrivy: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/hooks/usePrivySessionBootstrap", () => ({
  usePrivySessionBootstrap: vi.fn(),
}));

vi.mock("@/lib/api/auth-storage", () => ({
  clearInternalSession: vi.fn(),
}));

describe("PrivyLoginPanel", () => {
  const login = vi.fn();
  const logout = vi.fn();
  const push = vi.fn();
  const bootstrapSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(useRouter).mockReturnValue({
      push,
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useLogin).mockReturnValue({
      login,
    } as unknown as ReturnType<typeof useLogin>);
    vi.mocked(usePrivySessionBootstrap).mockReturnValue({
      bootstrapSession,
      canBootstrapSession: true,
      isBootstrapping: false,
      error: null,
    });
    bootstrapSession.mockResolvedValue({
      accessToken: "internal-jwt",
      needsRoleSelection: false,
      user: {
        id: "user-1",
        email: "owner@empresa.com",
        role: "pme",
        privyStellarWalletAddress: "GPRIVYWALLET",
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("opens Privy login when the visitor is not authenticated", async () => {
    vi.mocked(usePrivy).mockReturnValue({
      ready: true,
      authenticated: false,
      logout,
    } as unknown as ReturnType<typeof usePrivy>);
    render(<PrivyLoginPanel />);

    await userEvent.click(screen.getByRole("button", { name: /entrar com privy/i }));

    expect(login).toHaveBeenCalled();
    expect(bootstrapSession).not.toHaveBeenCalled();
  });

  it("automatically exchanges the session and routes after Privy authenticates", async () => {
    vi.mocked(usePrivy).mockReturnValue({
      ready: true,
      authenticated: true,
      logout,
    } as unknown as ReturnType<typeof usePrivy>);
    render(<PrivyLoginPanel />);

    await waitFor(() => expect(bootstrapSession).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/pme/dashboard");
  });

  it("waits for the identity token before automatically exchanging a session", async () => {
    vi.mocked(usePrivy).mockReturnValue({
      ready: true,
      authenticated: true,
      logout,
    } as unknown as ReturnType<typeof usePrivy>);
    vi.mocked(usePrivySessionBootstrap).mockReturnValue({
      bootstrapSession,
      canBootstrapSession: false,
      isBootstrapping: false,
      error: null,
    });

    const { rerender } = render(<PrivyLoginPanel />);

    expect(bootstrapSession).not.toHaveBeenCalled();

    vi.mocked(usePrivySessionBootstrap).mockReturnValue({
      bootstrapSession,
      canBootstrapSession: true,
      isBootstrapping: false,
      error: null,
    });
    rerender(<PrivyLoginPanel />);

    await waitFor(() => expect(bootstrapSession).toHaveBeenCalledOnce());
  });

  it("logs out of Privy and clears the internal session", async () => {
    vi.mocked(usePrivy).mockReturnValue({
      ready: true,
      authenticated: true,
      logout,
    } as unknown as ReturnType<typeof usePrivy>);
    render(<PrivyLoginPanel />);

    await userEvent.click(screen.getByRole("button", { name: /usar outra conta/i }));

    expect(logout).toHaveBeenCalled();
    expect(clearInternalSession).toHaveBeenCalled();
  });

  it("does not automatically exchange the session again after an authenticated remount", async () => {
    vi.mocked(usePrivy).mockReturnValue({
      ready: true,
      authenticated: true,
      logout,
    } as unknown as ReturnType<typeof usePrivy>);

    const firstRender = render(<PrivyLoginPanel />);
    await waitFor(() => expect(bootstrapSession).toHaveBeenCalledOnce());

    firstRender.unmount();
    render(<PrivyLoginPanel />);

    expect(bootstrapSession).toHaveBeenCalledOnce();
  });

  it("allows a deliberate retry after automatic exchange was already attempted", async () => {
    vi.mocked(usePrivy).mockReturnValue({
      ready: true,
      authenticated: true,
      logout,
    } as unknown as ReturnType<typeof usePrivy>);

    const firstRender = render(<PrivyLoginPanel />);
    await waitFor(() => expect(bootstrapSession).toHaveBeenCalledOnce());

    firstRender.unmount();
    render(<PrivyLoginPanel />);
    await userEvent.click(screen.getByRole("button", { name: /continuar/i }));

    expect(bootstrapSession).toHaveBeenCalledTimes(2);
  });
});
