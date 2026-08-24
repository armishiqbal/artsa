import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  variant?: "default" | "hero" | "compact";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  const iconWrap = (
    <div
      className={cn(
        variant === "hero"
          ? "mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted/50"
          : variant === "compact"
            ? "mx-auto"
            : "mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted"
      )}
    >
      <Icon
        className={cn(
          "text-muted-foreground",
          variant === "hero" ? "h-7 w-7" : variant === "compact" ? "h-8 w-8 opacity-50" : "h-6 w-6"
        )}
        aria-hidden
      />
    </div>
  );

  const content = (
    <>
      {iconWrap}
      <h3
        className={cn(
          "font-medium text-foreground",
          variant === "hero" ? "text-base" : variant === "compact" ? "mt-3 text-sm" : "text-sm"
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "text-muted-foreground",
          variant === "hero"
            ? "mt-2 max-w-md text-sm"
            : variant === "compact"
              ? "mt-1 text-xs"
              : "mt-1 max-w-sm text-sm"
        )}
      >
        {description}
      </p>
      {action && (
        <div className={variant === "hero" ? "mt-5" : variant === "compact" ? "mt-3" : "mt-4"}>
          {action}
        </div>
      )}
    </>
  );

  if (variant === "hero") {
    return (
      <div
        className={cn(
          "flex min-h-[360px] flex-col items-center justify-center surface-panel px-6 py-16 text-center",
          className
        )}
      >
        {content}
      </div>
    );
  }

  if (variant === "compact") {
    return <div className={cn("px-4 py-8 text-center", className)}>{content}</div>;
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center surface-inset border-dashed px-6 py-16 text-center",
        className
      )}
    >
      {content}
    </div>
  );
}
