import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

/** What a list looks like when it has nothing in it yet, and what to do next. */
export function EmptyState({
  icon = "info",
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-card p-5 sm:flex-row sm:items-center",
        className,
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-muted-foreground">
        <Icon name={icon} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
