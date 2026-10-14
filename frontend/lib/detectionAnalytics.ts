/** Detection rate from judged campaign outcomes returned by /telemetry/ops. */

export interface CampaignDetectionMetrics {
  detection_rate?: number | null;
  judged?: number | null;
}

export interface DetectionPoint {
  index: number;
  label: string;
  detectionRate: number;
  judged: number;
}

export function buildDetectionSeries(
  metrics: CampaignDetectionMetrics | null | undefined
): DetectionPoint[] {
  if (!metrics) return [];
  const rate = metrics.detection_rate;
  const judged = metrics.judged;
  if (
    typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 100 ||
    typeof judged !== "number" || !Number.isInteger(judged) || judged <= 0
  ) {
    return [];
  }
  return [{ index: 1, label: "Completed campaign outcomes", detectionRate: rate, judged }];
}

export function detectionSeriesToCsv(rows: DetectionPoint[]): string {
  const header = "cohort,detection_rate_percent,judged_outcomes";
  const lines = rows.map(
    (row) => `"${row.label.replace(/"/g, '""')}",${row.detectionRate.toFixed(1)},${row.judged}`
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
