"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { DetectionPoint } from "@/lib/detectionAnalytics";

export const DetectionRateChart = dynamic(
  () => import("./DetectionRateChartInner"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[260px] w-full rounded-lg" />,
  }
);

export type { DetectionPoint };
