"use client";

import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  className?: string;
  duration?: number;
}

/** Count-up for metric tiles — respects reduced-motion. */
export function AnimatedNumber({ value, className, duration = 0.55 }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(display, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps -- animate from current display

  return (
    <span className={cn("tabular-nums", className)} aria-live="polite">
      {display}
    </span>
  );
}
