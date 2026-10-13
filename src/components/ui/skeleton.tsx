import { cn } from "@/lib/utils";

/** A grey placeholder shown while a page loads on a slow connection. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-2xl bg-accent", className)}
    />
  );
}
