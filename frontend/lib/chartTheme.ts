/** Shared Recharts styling for enterprise dark ops surfaces. */

import type { CSSProperties } from "react";

/** Axis labels — bright enough on near-black dashboards. */
export const CHART_AXIS_TICK = {
  fontSize: 10,
  fill: "#c4c4c4",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export const CHART_GRID = {
  stroke: "#3a3a3a",
  strokeDasharray: "3 6",
  vertical: false,
} as const;

/**
 * Tooltip panel — elevated surface so hover is readable on black charts.
 * Pair with CHART_TOOLTIP_ITEM_STYLE / LABEL_STYLE (Recharts defaults item text to black).
 */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: "#1e1e1e",
  border: "1px solid #525252",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f5f5f5",
  boxShadow: "0 10px 28px rgba(0,0,0,0.65)",
  padding: "8px 10px",
};

export const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: "#f5f5f5",
  fontWeight: 600,
  marginBottom: 4,
};

export const CHART_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: "#e8e8e8",
  fontSize: 12,
};

/** Props spread onto every Recharts `<Tooltip />` for readable dark-mode hover. */
export const CHART_TOOLTIP_PROPS = {
  contentStyle: CHART_TOOLTIP_STYLE,
  labelStyle: CHART_TOOLTIP_LABEL_STYLE,
  itemStyle: CHART_TOOLTIP_ITEM_STYLE,
  wrapperStyle: { outline: "none", zIndex: 40 } as CSSProperties,
  cursor: { fill: "rgba(255,255,255,0.04)" },
} as const;

export const CHART_PRIMARY = "#6798ff";
export const CHART_MUTED = "#454545";
export const CHART_CRITICAL = "hsl(var(--severity-critical))";
export const CHART_HIGH = "hsl(var(--severity-high))";
