"use client";

import { X, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/lib/stores/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border bg-card",
  success: "border-status-success/30 bg-status-success/10",
  error: "border-destructive/30 bg-destructive/10",
  warning: "border-status-warning/30 bg-status-warning/10",
};

const variantIcon: Record<ToastVariant, typeof CheckCircle2> = {
  default: AlertCircle,
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const Icon = variantIcon[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm",
              variantStyles[t.variant]
            )}
            role="status"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
