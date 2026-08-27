/** Shared download helpers for Red Team Outcomes / Monitor exports. */

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ];
  return lines.join("\n");
}

export function downloadJson(filename: string, data: unknown): void {
  downloadTextFile(filename, JSON.stringify(data, null, 2), "application/json");
}
