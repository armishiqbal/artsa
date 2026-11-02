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
import { LandingSignInProvider, useLandingSignIn } from "./LandingSignInContext";
import { LandingContactProvider, useLandingContact } from "./LandingContactContext";
import { LandingSignInPanel } from "./LandingSignInPanel";
import { LandingContactSalesPanel } from "./LandingContactSales";

function LandingPageInner() {
  const signIn = useLandingSignIn();
  const contact = useLandingContact();

  return (
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

      {/* Interactive In-Place Modals (Page does NOT scroll down) */}
      <LandingSignInPanel
        open={signIn.open}
        onClose={signIn.closeSignIn}
        initialMode={signIn.mode}
        returnTo={signIn.returnTo}
        onContactSales={() => {
          signIn.closeSignIn();
          contact.openContactSales();
        }}
      />
      <LandingContactSalesPanel
        open={contact.open}
        onClose={contact.closeContactSales}
        onLogin={() => {
          contact.closeContactSales();
          signIn.openSignIn({ mode: "login" });
        }}
      />
    </div>
  );
}

export function LandingPage() {
  return (
    <LandingSignInRoot>
      <LandingContactProvider>
        <LandingSignInProvider>
          <LandingPageInner />
        </LandingSignInProvider>
      </LandingContactProvider>
    </LandingSignInRoot>
  );
}
