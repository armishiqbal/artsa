import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-8 w-8 rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "h-9 w-9 rounded-lg [&_svg]:h-4 [&_svg]:w-4",
  lg: "h-10 w-10 rounded-xl [&_svg]:h-5 [&_svg]:w-5",
} as const;

interface IconTileProps {
  children: React.ReactNode;
  size?: keyof typeof sizeClasses;
  className?: string;
  active?: boolean;
}

/** Consistent icon-in-a-box treatment across headers, cards, and lists. */
export function IconTile({ children, size = "md", className, active }: IconTileProps) {
  return (
    <div
      className={cn(
        "icon-tile flex shrink-0 items-center justify-center border border-border/70 bg-muted/40 text-muted-foreground",
        sizeClasses[size],
        active && "border-foreground/20 text-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
