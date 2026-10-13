import * as React from "react";
import { cn } from "@/lib/utils";

/** Label above, control, then help or error text: the one form row layout. */
export function Field({
  id,
  label,
  help,
  error,
  children,
  className,
}: {
  /** The control's id, so the label is linked to it. */
  id: string;
  label: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="text-sm font-semibold text-destructive"
        >
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

const control =
  "w-full rounded-xl border-2 border-input bg-card px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-[invalid=true]:border-destructive";

export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(control, "min-h-[52px]", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  rows = 4,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(control, "py-3", className)}
      {...props}
    />
  );
}
