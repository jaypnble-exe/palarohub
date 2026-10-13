import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while a commissioner page loads on a slow connection. */
export default function Loading() {
  return (
    <main className="space-y-5 py-6" aria-busy="true">
      <Skeleton className="h-36" />
      <Skeleton className="h-7 w-2/3" />
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </main>
  );
}
