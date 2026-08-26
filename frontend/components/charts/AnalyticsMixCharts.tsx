"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActionSlice, RankedItem, VolumeBucket } from "@/lib/enterpriseAnalytics";

export const ActionMixChart = dynamic(() => import("./ActionMixChartInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-lg" />,
});

export const RankedBarChart = dynamic(() => import("./RankedBarChartInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[240px] w-full rounded-lg" />,
});

export const VolumeStackedChart = dynamic(() => import("./VolumeStackedChartInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-lg" />,
});

export type { ActionSlice, RankedItem, VolumeBucket };
