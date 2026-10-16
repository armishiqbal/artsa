"use client";

import { LandingAnnouncementBar } from "./LandingAnnouncementBar";
import { LandingBackdrop } from "./LandingBackdrop";
import { LandingHero } from "./LandingHero";
import { LandingLogoWall } from "./LandingLogoWall";
import { LandingChallenge } from "./LandingChallenge";
import { LandingSolution } from "./LandingSolution";
import { LandingMultiAgentFlow } from "./LandingMultiAgentFlow";
import { LandingBoundaries } from "./LandingBoundaries";
import { LandingCodeShowcase } from "./LandingCodeShowcase";
import { LandingPricing } from "./LandingPricing";
import { LandingFAQ } from "./LandingFAQ";
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
            <LandingChallenge />
            <LandingSolution />
            <LandingMultiAgentFlow />
            <LandingBoundaries />
            <LandingCodeShowcase />
            <LandingPricing />
            <LandingFAQ />
            <LandingContactSection />
          </main>
          <LandingFooter />
        </div>
      </div>
    </LandingSignInRoot>
  );
}
