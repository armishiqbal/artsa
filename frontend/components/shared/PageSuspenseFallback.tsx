import { Loader2 } from "lucide-react";

export function PageSuspenseFallback({ label }: { label: string }) {
  return (
    <div className="surface-panel flex flex-col items-center justify-center gap-3 py-24 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
