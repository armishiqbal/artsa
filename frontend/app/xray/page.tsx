"use client";

import { Layers } from 'lucide-react';
import GuardrailPenetrationXRay from '@/components/GuardrailPenetrationXRay';

export default function XRayPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-soc-text tracking-tight flex items-center gap-2.5">
          <Layers className="w-6 h-6 text-soc-accent" />
          Defense Depth X-Ray & Layer Diagnostics
        </h1>
        <p className="text-sm text-soc-muted mt-1">
          Inspect layer-by-layer breakdown showing exactly where the 5-stage defense chain passed or breached.
        </p>
      </div>

      <GuardrailPenetrationXRay bypassDepth={3} />
    </div>
  );
}
