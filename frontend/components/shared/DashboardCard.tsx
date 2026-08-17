"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  delay?: number;
}

export function DashboardCard({
  title,
  description,
  badge,
  icon,
  actions,
  children,
  className,
  contentClassName,
  delay = 0,
}: DashboardCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
    >
      <Card className={cn("shadow-card", className)}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="flex items-start gap-3 space-y-0">
            {icon && (
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40">
                {icon}
              </div>
            )}
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {badge}
          </div>
        </CardHeader>
        <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
      </Card>
    </motion.div>
  );
}
