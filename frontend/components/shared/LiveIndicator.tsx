import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  connected: boolean;
  label?: string;
  className?: string;
}

export function LiveIndicator({ connected, label, className }: LiveIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        connected
          ? "border-status-success/30 bg-status-success/10 text-status-success"
          : "border-status-warning/30 bg-status-warning/10 text-status-warning",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            connected ? "bg-status-success" : "bg-status-warning"
          )}
        />
      </span>
      {label ?? (connected ? "Live feed connected" : "Polling fallback")}
    </span>
  );
}
