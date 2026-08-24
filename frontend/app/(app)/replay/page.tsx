import { Suspense } from "react";
import RoundReplayPage from "./ReplayContent";
import { PageSuspenseFallback } from "@/components/shared/PageSuspenseFallback";

export default function ReplayPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback label="Loading session replay…" />}>
      <RoundReplayPage />
    </Suspense>
  );
}
