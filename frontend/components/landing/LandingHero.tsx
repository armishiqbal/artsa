"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { easeOut } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";
import { LandingContactSalesButton } from "./LandingContactSalesButton";
import { LandingHeroPreview } from "./LandingHeroPreview";

export function LandingHero() {
  return (
    <section className="lp-hero relative pt-8 sm:pt-12">
      <div className="lp-shell">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: easeOut }}
          >
            <p className="lp-eyebrow">Operating system for agent security</p>
            <h1 className="lp-display mt-6">
              Contain AI agents before they escape.
            </h1>
            <p className="lp-body mt-6 max-w-lg">
              Score every tool call in milliseconds, quarantine escapes in-session, and prove
              control to auditors — from factory-floor agents to multi-agent pipelines.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LandingContactSalesButton variant="ghost" className="lp-btn-primary">
                Contact sales
              </LandingContactSalesButton>
              <Link href={demoHref("guard")} className="lp-btn-secondary">
                Try ARTSA free
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.55, ease: easeOut }}
            className="lp-product-preview"
          >
            <LandingHeroPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
