"use client";

import React from "react";

interface SeverityBadgeProps {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const badgeStyles = {
    LOW: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    HIGH: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    CRITICAL: "bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold animate-pulse",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${badgeStyles[severity]}`}>
      {severity}
    </span>
  );
}
