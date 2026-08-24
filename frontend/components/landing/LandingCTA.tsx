"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { easeOut } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";
import { LandingSignInButton } from "./LandingSignInButton";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

export function LandingCTA() {
  return (
    <section className="lp-section border-t border-[var(--color-steel-border)]">
      <div className="lp-shell">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: easeOut }}
        >
          <p className="lp-eyebrow">Get started</p>
          <h2 className="lp-heading mt-6 max-w-2xl">
            Deploy containment where your agents already run
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LandingContactSalesButton variant="ghost" className="lp-btn-primary">
              Contact sales
            </LandingContactSalesButton>
            <Link href={demoHref("guard")} className="lp-btn-secondary">
              Try live demo
            </Link>
            <LandingSignInButton
              variant="ghost"
              className="lp-btn-ghost hover:bg-transparent"
              signInOptions={{ returnTo: "/dashboard", mode: "register" }}
            >
              Start building
            </LandingSignInButton>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
