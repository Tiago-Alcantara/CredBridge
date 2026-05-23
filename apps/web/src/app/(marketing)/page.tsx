import { headers } from "next/headers";
import { TopNav } from "@/components/patterns/TopNav";
import { HeroNetwork } from "@/components/marketing/HeroNetwork";
import { StatsBar } from "@/components/marketing/StatsBar";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Audiences } from "@/components/marketing/Audiences";
import { LandingFooter } from "@/components/marketing/LandingFooter";

const PUBLIC_LANDING_HEADER = "x-credbridge-public-landing";

export default async function MarketingLandingPage() {
  const requestHeaders = await headers();
  const publicOnly = requestHeaders.get(PUBLIC_LANDING_HEADER) === "true";

  return (
    <>
      <TopNav publicOnly={publicOnly} />
      <main>
        <HeroNetwork publicOnly={publicOnly} />
        <StatsBar />
        <HowItWorks />
        <Audiences publicOnly={publicOnly} />
      </main>
      <LandingFooter />
    </>
  );
}
