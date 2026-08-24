"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconTile } from "@/components/shared/IconTile";
import { MotionCard } from "@/components/motion/MotionCard";
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

/** Content panel — static surface with consistent header rhythm. */
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
    <MotionCard hover className={cn("surface-panel overflow-hidden", className)}>
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="dashboard-card-header flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="flex items-start gap-3 space-y-0">
            {icon && <IconTile size="sm">{icon}</IconTile>}
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
              {description && <CardDescription className="leading-relaxed">{description}</CardDescription>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {badge}
          </div>
        </CardHeader>
        <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
      </Card>
    </MotionCard>
  );
}
