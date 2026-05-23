import { render, screen } from "@testing-library/react";
import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import MarketingLandingPage from "./page";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/components/patterns/TopNav", () => ({
  TopNav: ({ publicOnly }: { publicOnly?: boolean }) => (
    <span data-testid="top-nav-mode">{String(publicOnly)}</span>
  ),
}));

vi.mock("@/components/marketing/HeroNetwork", () => ({
  HeroNetwork: ({ publicOnly }: { publicOnly?: boolean }) => (
    <span data-testid="hero-mode">{String(publicOnly)}</span>
  ),
}));

vi.mock("@/components/marketing/Audiences", () => ({
  Audiences: ({ publicOnly }: { publicOnly?: boolean }) => (
    <span data-testid="audiences-mode">{String(publicOnly)}</span>
  ),
}));

vi.mock("@/components/marketing/StatsBar", () => ({
  StatsBar: () => null,
}));

vi.mock("@/components/marketing/HowItWorks", () => ({
  HowItWorks: () => null,
}));

vi.mock("@/components/marketing/LandingFooter", () => ({
  LandingFooter: () => null,
}));

describe("MarketingLandingPage", () => {
  it("renders the public-only variant when the public hostname is marked", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-credbridge-public-landing": "true" }) as Awaited<
        ReturnType<typeof headers>
      >,
    );

    render(await MarketingLandingPage());

    expect(screen.getByTestId("top-nav-mode")).toHaveTextContent("true");
    expect(screen.getByTestId("hero-mode")).toHaveTextContent("true");
    expect(screen.getByTestId("audiences-mode")).toHaveTextContent("true");
  });
});
