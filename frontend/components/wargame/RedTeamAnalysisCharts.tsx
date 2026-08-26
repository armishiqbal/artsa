"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { RoundTrendPoint, VerdictSlice } from "@/lib/redTeamAnalytics";

export const RedTeamRoundTrendChart = dynamic(() => import("./RedTeamRoundTrendChartInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-lg" />,
});

export const RedTeamVerdictChart = dynamic(() => import("./RedTeamVerdictChartInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-lg" />,
});

export type { RoundTrendPoint, VerdictSlice };
