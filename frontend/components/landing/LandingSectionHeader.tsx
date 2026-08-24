"use client";

import { motion } from "framer-motion";
import { easeOut, pageHeaderMotion } from "@/lib/motionPresets";
import { cn } from "@/lib/utils";

interface LandingSectionHeaderProps {
  id?: string;
  badge: string;
  title: string;
  description?: string;
  className?: string;
  align?: "left" | "center";
}

export function LandingSectionHeader({
  id,
  badge,
  title,
  description,
  className,
  align = "left",
}: LandingSectionHeaderProps) {
  return (
    <motion.header
      id={id}
      className={cn(
        "mb-10 max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
      variants={pageHeaderMotion}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
    >
      <motion.p
        className="lp-eyebrow"
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        {badge}
      </motion.p>
      <h2 className="lp-heading mt-6">{title}</h2>
      {description ? <p className="lp-body mt-4">{description}</p> : null}
    </motion.header>
  );
}
