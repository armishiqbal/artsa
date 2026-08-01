"use client";

import React from "react";

interface RiskScoreProps {
  score: number;
}

export function RiskScore({ score }: RiskScoreProps) {
  const getScoreColor = (val: number) => {
    if (val >= 80) return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    if (val >= 50) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  };

  return (
    <span className={`inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded text-xs border ${getScoreColor(score)}`}>
      <span className="font-semibold">{score.toFixed(1)}</span>
      <span className="text-[10px] opacity-70">/100</span>
    </span>
  );
}
