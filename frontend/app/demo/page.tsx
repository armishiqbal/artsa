import { Suspense } from "react";
import { DemoPlayground } from "@/components/demo/DemoPlayground";
import { DemoShell } from "@/components/demo/DemoShell";

function DemoFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Loading interactive demo…
    </div>
  );
}

export default function DemoPage() {
  return (
    <DemoShell>
      <Suspense fallback={<DemoFallback />}>
        <DemoPlayground />
      </Suspense>
    </DemoShell>
  );
}
