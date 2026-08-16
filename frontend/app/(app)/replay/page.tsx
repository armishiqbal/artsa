import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import RoundReplayPage from "./ReplayContent";

export default function ReplayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
          Loading session replay…
        </div>
      }
    >
      <RoundReplayPage />
    </Suspense>
  );
}
