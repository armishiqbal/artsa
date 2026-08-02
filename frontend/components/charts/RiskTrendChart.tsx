"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const RiskTrendChart = dynamic(() => import("./RiskTrendChartInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full rounded-lg" />,
});
