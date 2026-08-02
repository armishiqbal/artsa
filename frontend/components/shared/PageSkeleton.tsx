import { Skeleton } from "@/components/ui/skeleton";

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return <Skeleton className="h-48 w-full rounded-lg" />;
}

export function PageLoadingSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-16 w-full max-w-lg rounded-lg" />
      <StatCardsSkeleton />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
