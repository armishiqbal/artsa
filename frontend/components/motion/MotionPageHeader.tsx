"use client";

import { motion } from "framer-motion";
import { IconTile } from "@/components/shared/IconTile";
import { pageHeaderMotion } from "@/lib/motionPresets";
import { cn } from "@/lib/utils";

interface MotionPageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

/** Animated page header — title reveal + accent rule shimmer. */
export function MotionPageHeader({
  title,
  description,
  icon,
  actions,
  badge,
  className,
}: MotionPageHeaderProps) {
  return (
    <motion.header
      className={cn(
        "page-header-rule motion-page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
      initial="hidden"
      animate="visible"
      variants={pageHeaderMotion}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-start gap-3">
          {icon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.05 }}
            >
              <IconTile size="md">{icon}</IconTile>
            </motion.div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="page-title motion-title-shimmer">{title}</h1>
              {badge}
            </div>
            {description && (
              <motion.p
                className="page-lead"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.12, duration: 0.4 }}
              >
                {description}
              </motion.p>
            )}
          </div>
        </div>
      </div>
      {actions && (
        <motion.div
          className="flex shrink-0 flex-wrap items-center gap-2"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
        >
          {actions}
        </motion.div>
      )}
    </motion.header>
  );
}
