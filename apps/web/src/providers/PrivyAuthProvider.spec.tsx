import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivyAuthProvider } from "./PrivyAuthProvider";

const { privyProviderPropsMock } = vi.hoisted(() => ({
  privyProviderPropsMock: vi.fn(),
}));

vi.mock("@privy-io/react-auth", () => ({
  PrivyProvider: ({
    children,
    ...providerProps
  }: {
    children: ReactNode;
    [propertyName: string]: unknown;
  }) => {
    privyProviderPropsMock(providerProps);
    return <div data-testid="privy-provider">{children}</div>;
  },
}));

describe("PrivyAuthProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    privyProviderPropsMock.mockReset();
  });

  it("configures Privy authentication without automatic wallet creation", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "privy-app-id");
    vi.stubEnv("NEXT_PUBLIC_PRIVY_CLIENT_ID", "privy-client-id");

    render(
      <PrivyAuthProvider>
        <span>Protected content</span>
      </PrivyAuthProvider>,
    );

    expect(screen.getByTestId("privy-provider")).toHaveTextContent("Protected content");
    expect(privyProviderPropsMock).toHaveBeenCalledWith({
      appId: "privy-app-id",
      clientId: "privy-client-id",
      config: {
        loginMethods: ["email", "google"],
        embeddedWallets: {
          showWalletUIs: false,
        },
      },
    });
  });

  it("throws a useful error when the public Privy app id is absent", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "");

    expect(() =>
      render(
        <PrivyAuthProvider>
          <span>Protected content</span>
        </PrivyAuthProvider>,
      ),
    ).toThrow("NEXT_PUBLIC_PRIVY_APP_ID must be configured");
  });
});
