import { Suspense } from "react";
import LogsContent from "./LogsContent";
import { PageSuspenseFallback } from "@/components/shared/PageSuspenseFallback";

export default function LogsPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback label="Loading activity log…" />}>
      <LogsContent />
    </Suspense>
  );
}
