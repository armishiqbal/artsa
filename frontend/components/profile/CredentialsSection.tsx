"use client";

import { LiveTokenInspector } from "@/components/profile/LiveTokenInspector";
import { DangerZoneSection } from "@/components/profile/DangerZoneSection";

export function CredentialsSection() {
  return (
    <div className="space-y-8">
      <LiveTokenInspector />
      <DangerZoneSection />
    </div>
  );
}
