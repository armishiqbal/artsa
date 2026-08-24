"use client";

import { Children } from "react";
import { motion } from "framer-motion";
import { staggerContainer, fadeUp, easeOut } from "@/lib/motionPresets";
import { cn } from "@/lib/utils";

/** Consistent vertical rhythm with optional Framer stagger entrance. */
export function PageStack({
  children,
  className,
  stagger = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger child sections on enter — premium page feel. */
  stagger?: boolean;
}) {
  if (!stagger) {
    return <div className={cn("space-y-6", className)}>{children}</div>;
  }

  const items = Children.toArray(children);

  return (
    <motion.div
      className={cn("space-y-6", className)}
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {items.map((child, i) => (
        <motion.div key={i} variants={fadeUp} transition={{ duration: 0.38, ease: easeOut }}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
