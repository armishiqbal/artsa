"use client";

import { LandingAnnouncementBar } from "./LandingAnnouncementBar";
import { LandingBackdrop } from "./LandingBackdrop";
import { LandingHero } from "./LandingHero";
import { LandingLogoWall } from "./LandingLogoWall";
import { LandingSolution } from "./LandingSolution";
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
        className="lp lp--obsidian relative min-h-screen bg-[#070707] text-white selection:bg-neutral-800 selection:text-white"
        data-theme="dark"
      >
        <LandingBackdrop />
        <div className="relative z-10 flex min-h-screen flex-col">
          <LandingAnnouncementBar />
          <LandingNav />
          <main id="main-content" className="flex-1">
            <LandingHero />
            <LandingLogoWall />
            <LandingSolution />
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
