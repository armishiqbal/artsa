"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconTile } from "@/components/shared/IconTile";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/** Static dashboard panel — no hover lift or enter motion (HCI: calm product chrome). */
export function DashboardCard({
  title,
  description,
  badge,
  icon,
  actions,
  children,
  className,
  contentClassName,
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground",
        className
      )}
    >
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="dashboard-card-header flex flex-row items-start justify-between space-y-0 p-5 pb-4 sm:p-6">
          <div className="flex items-start gap-3 space-y-0">
            {icon && <IconTile size="sm">{icon}</IconTile>}
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {badge}
          </div>
        </CardHeader>
        <CardContent className={cn("p-5 pt-0 sm:p-6", contentClassName)}>{children}</CardContent>
      </Card>
    </div>
  );
}
