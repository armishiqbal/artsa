"use client";

import { MotionPageHeader } from "@/components/motion/MotionPageHeader";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

/** Page title block with motion entrance — use across product pages. */
export function PageHeader(props: PageHeaderProps) {
  return <MotionPageHeader {...props} />;
}
