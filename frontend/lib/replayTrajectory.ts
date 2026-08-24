/** Shared trajectory classification for replay / autopsy views. */

const RECON_TOOLS = ["list", "read", "search", "whoami", "getcwd", "stat", "glob"];
const ESCALATION_TOOLS = ["exec", "delete", "chmod", "sudo", "shell", "nc", "tunnel", "reverse", "bash"];

export type TrajectoryAction =
  | "Reconnaissance"
  | "Tool execution"
  | "Privilege escalation"
  | "Sandbox escape"
  | "Containment";

export function categorizeTrajectoryAction(tool: string, verdict?: string | null): TrajectoryAction {
  const t = tool.toLowerCase();
  if (verdict === "BREACHED" || verdict === "CRITICAL") return "Sandbox escape";
  if (ESCALATION_TOOLS.some((k) => t.includes(k))) return "Privilege escalation";
  if (RECON_TOOLS.some((k) => t.includes(k))) return "Reconnaissance";
  if (verdict === "SUSPICIOUS" || verdict === "HIGH") return "Containment";
  return "Tool execution";
}

export function trajectoryActionTone(action: TrajectoryAction): string {
  switch (action) {
    case "Sandbox escape":
      return "border-severity-critical/40 bg-severity-critical/10 text-severity-critical";
    case "Privilege escalation":
      return "border-severity-high/40 bg-severity-high/10 text-severity-high";
    case "Reconnaissance":
      return "border-border bg-muted/50 text-muted-foreground";
    case "Containment":
      return "border-status-warning/40 bg-status-warning/10 text-status-warning";
    default:
      return "border-border bg-card text-foreground";
  }
}
