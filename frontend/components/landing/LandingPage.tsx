"use client";

import { LandingAnnouncementBar } from "./LandingAnnouncementBar";
import { LandingBackdrop } from "./LandingBackdrop";
import { LandingHero } from "./LandingHero";
import { LandingLogoWall } from "./LandingLogoWall";
import { LandingStats } from "./LandingStats";
import { LandingChallenge } from "./LandingChallenge";
import { LandingSolution } from "./LandingSolution";
import { LandingMultiAgentFlow } from "./LandingMultiAgentFlow";
import { LandingFeatureBento } from "./LandingFeatureBento";
import { LandingFindingsSpotlight } from "./LandingFindingsSpotlight";
import { LandingBoundaries } from "./LandingBoundaries";
import { LandingCodeShowcase } from "./LandingCodeShowcase";
import { LandingComparison } from "./LandingComparison";
import { LandingUseCases } from "./LandingUseCases";
import { LandingPricing } from "./LandingPricing";
import { LandingFAQ } from "./LandingFAQ";
import { LandingCTA } from "./LandingCTA";
import { LandingContactSection } from "./LandingContactSection";
import { LandingFooter } from "./LandingFooter";
import { LandingNav } from "./LandingNav";
import { LandingSignInRoot } from "./LandingSignInRoot";

export function LandingPage() {
  return (
    <LandingSignInRoot>
      <div
        className="lp lp--light relative min-h-screen bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900"
        data-theme="light"
      >
        <LandingBackdrop />
        <div className="relative z-10 flex min-h-screen flex-col">
          <LandingAnnouncementBar />
          <LandingNav />
          <main id="main-content" className="flex-1">
            <LandingHero />
            <LandingLogoWall />
            <LandingStats />
            <LandingChallenge />
            <LandingSolution />
            <LandingMultiAgentFlow />
            <LandingFeatureBento />
            <LandingFindingsSpotlight />
            <LandingBoundaries />
            <LandingCodeShowcase />
            <LandingComparison />
            <LandingUseCases />
            <LandingPricing />
            <LandingFAQ />
            <LandingCTA />
            <LandingContactSection />
          </main>
          <LandingFooter />
        </div>
      </div>
    </LandingSignInRoot>
  );
}
