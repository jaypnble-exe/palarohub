import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The main buttons of a step-by-step form, kept in reach at the bottom of
 * the screen. On phones it sits just above the bottom navigation bar.
 */
export function ActionBar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 -mx-5 border-t border-border bg-background/95 px-5 py-3 backdrop-blur sm:bottom-0 sm:mx-0 sm:rounded-2xl sm:border",
        className,
      )}
    >
      <div className="flex gap-3">{children}</div>
    </div>
  );
}
