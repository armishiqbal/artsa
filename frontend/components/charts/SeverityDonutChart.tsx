"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeveritySlice } from "@/lib/enterpriseAnalytics";

export const SeverityDonutChart = dynamic(() => import("./SeverityDonutChartInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full rounded-lg" />,
});

export type { SeveritySlice };
