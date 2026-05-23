import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopNav } from "@/components/patterns/TopNav";
import { Audiences } from "./Audiences";
import { HeroNetwork } from "./HeroNetwork";

vi.mock("@/components/primitives/Icon", () => ({
  Icon: () => null,
}));

vi.mock("@/components/primitives/Logo", () => ({
  Logo: () => <span>CredBridge</span>,
}));

vi.mock("./HeroNetworkBG", () => ({
  HeroNetworkBG: () => null,
}));

vi.mock("@/lib/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("public landing mode", () => {
  it("does not expose login or dashboard entry links", () => {
    const { container } = render(
      <>
        <TopNav publicOnly />
        <HeroNetwork publicOnly />
        <Audiences publicOnly />
      </>,
    );

    expect(container.querySelector('a[href^="/login"]')).toBeNull();
    expect(container.querySelector('a[href^="/partner/dashboard"]')).toBeNull();
  });
});
