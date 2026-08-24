"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cardHover, easeOut } from "@/lib/motionPresets";
import { cn } from "@/lib/utils";

interface MotionCardProps extends HTMLMotionProps<"div"> {
  hover?: boolean;
  reveal?: boolean;
}

/** Subtle lift + fade — Lovable-grade card motion without purple slop. */
export function MotionCard({
  children,
  className,
  hover = true,
  reveal = true,
  ...props
}: MotionCardProps) {
  return (
    <motion.div
      initial={reveal ? { opacity: 0, y: 8 } : false}
      animate={reveal ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.38, ease: easeOut }}
      whileHover={hover ? "hover" : undefined}
      variants={hover ? cardHover : undefined}
      className={cn("motion-card", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
