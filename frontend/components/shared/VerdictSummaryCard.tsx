import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { cn } from "@/lib/utils";
import { complianceMapping, type VerdictSummary } from "@/lib/verdict";

interface VerdictSummaryCardProps {
  summary: VerdictSummary;
  /** Detector or attack category used for the OWASP / ATLAS mapping. */
  detector?: string | null;
  className?: string;
}

/**
 * Plain-language verdict panel: "what happened / why it matters / what we did"
 * with a compliance mapping. Non-experts read the top; auditors read the
 * OWASP / MITRE ATLAS footer. Severity is conveyed by icon + text + color,
 * never color alone.
 */
export function VerdictSummaryCard({ summary, detector, className }: VerdictSummaryCardProps) {
  const mapping = complianceMapping(detector);
  const Icon = summary.blocked
    ? ShieldAlert
    : summary.severity === "LOW"
      ? CheckCircle2
      : AlertTriangle;

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        summary.blocked
          ? "border-destructive/30 bg-destructive/5"
          : summary.severity === "LOW"
            ? "border-status-success/30 bg-status-success/5"
            : "border-status-warning/30 bg-status-warning/5",
        className
      )}
      role="status"
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-5 w-5 shrink-0",
            summary.blocked
              ? "text-destructive"
              : summary.severity === "LOW"
                ? "text-status-success"
                : "text-status-warning"
          )}
          aria-hidden
        />
        <span className="text-sm font-semibold text-foreground">{summary.label}</span>
        <SeverityBadge severity={summary.severity} />
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What happened
          </dt>
          <dd className="text-foreground">{summary.whatHappened}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Why it matters
          </dt>
          <dd className="text-foreground">{summary.whyItMatters}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What we did
          </dt>
          <dd className="text-foreground">{summary.whatWeDid}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">
        <Badge variant="secondary" className="text-[10px]">
          {mapping.owasp}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {mapping.atlas}
        </Badge>
      </div>
    </div>
  );
}
