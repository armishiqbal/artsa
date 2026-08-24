"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
  className?: string;
}

/** Sliding pill filter — tactile category switcher. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId = "segmented-pill",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "relative inline-flex flex-wrap gap-0.5 rounded-lg border border-border/80 surface-inset p-1",
        className
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "interactive-pill relative z-10 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="segmented-pill-active absolute inset-0 rounded-md"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
