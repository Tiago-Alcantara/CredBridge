"use client";

import { TopNav } from "@/components/patterns/TopNav";
import { HeroNetwork } from "@/components/marketing/HeroNetwork";
import { StatsBar } from "@/components/marketing/StatsBar";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Audiences } from "@/components/marketing/Audiences";
import { LandingFooter } from "@/components/marketing/LandingFooter";

export default function MarketingLandingPage() {
  return (
    <>
      <TopNav />
      <main>
        <HeroNetwork />
        <StatsBar />
        <HowItWorks />
        <Audiences />
      </main>
      <LandingFooter />
    </>
  );
}
