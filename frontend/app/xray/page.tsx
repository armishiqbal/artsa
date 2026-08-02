"use client";

import { Layers } from "lucide-react";
import GuardrailPenetrationXRay from "@/components/GuardrailPenetrationXRay";
import { PageHeader } from "@/components/shared/PageHeader";

export default function XRayPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Defense X-Ray"
        description="Layer-by-layer guardrail penetration analysis and bypass depth diagnostics."
        icon={<Layers className="h-5 w-5" />}
      />
      <GuardrailPenetrationXRay bypassDepth={3} />
    </div>
  );
}
