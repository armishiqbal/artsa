/** Short connection labels for TopNav — session counts belong on Command Center metrics only. */

import { CONNECTION_UI } from "@/lib/getStartedLabels";

export type ApiGatewayStatus = "fully_connected" | "offline" | "unknown";

export function formatTopNavConnectionLabel(
  apiOnline: boolean,
  wsConnected: boolean,
  apiGatewayStatus: ApiGatewayStatus
): string {
  if (!apiOnline) return CONNECTION_UI.offlineNav;
  if (wsConnected) return "Live";
  if (apiGatewayStatus === "fully_connected") return CONNECTION_UI.pollingNav;
  return CONNECTION_UI.pollingNav;
}

export function clampSessionCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}
