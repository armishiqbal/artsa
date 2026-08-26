/** Shared Recharts styling for enterprise dark ops surfaces. */

import type { CSSProperties } from "react";

export const CHART_AXIS_TICK = {
  fontSize: 10,
  fill: "#7c7c7c",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export const CHART_GRID = {
  stroke: "#313131",
  strokeDasharray: "3 6",
  vertical: false,
} as const;

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: "#141414",
  border: "1px solid #313131",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#a7a7a7",
  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
};

export const CHART_PRIMARY = "#6798ff";
export const CHART_MUTED = "#454545";
export const CHART_CRITICAL = "hsl(var(--severity-critical))";
export const CHART_HIGH = "hsl(var(--severity-high))";
