/** Detection-rate time series for Analytics — ARTSA live vs static baseline. */

export interface DetectionPoint {
  index: number;
  label: string;
  artsaRate: number;
  baselineRate: number;
}

export const STATIC_DETECTION_BASELINE = 62;

interface RiskTrendPoint {
  timestamp?: string;
  risk_score?: number;
}

export function buildDetectionSeries(
  riskTrend: RiskTrendPoint[] | undefined,
  defenseScore: number | undefined
): DetectionPoint[] {
  const trend = riskTrend ?? [];
  if (trend.length > 0) {
    return trend.map((point, index) => {
      const risk = Number(point.risk_score ?? 0);
      const artsaRate = Math.max(0, Math.min(100, 100 - risk));
      return {
        index: index + 1,
        label: point.timestamp
          ? new Date(point.timestamp).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })
          : `#${index + 1}`,
        artsaRate,
        baselineRate: STATIC_DETECTION_BASELINE,
      };
    });
  }

  // Single live point from defense score — never invent a fake time series
  if (defenseScore != null && defenseScore > 0) {
    return [
      {
        index: 1,
        label: "Live",
        artsaRate: Math.max(0, Math.min(100, defenseScore)),
        baselineRate: STATIC_DETECTION_BASELINE,
      },
    ];
  }

  return [];
}

export function detectionSeriesToCsv(rows: DetectionPoint[]): string {
  const header = "sample,label,artsa_detection_rate,static_baseline";
  const lines = rows.map(
    (r) => `${r.index},"${r.label.replace(/"/g, '""')}",${r.artsaRate.toFixed(1)},${r.baselineRate}`
  );
  return [header, ...lines].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
