"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { easeOut } from "@/lib/motionPresets";

export function PageContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}
