"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * An on/off setting as a whole tappable row: the label and an explanation
 * on the left, the switch on the right.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        disabled && "opacity-60",
        className,
      )}
    >
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer space-y-1">
        <span id={`${id}-label`} className="block font-semibold">
          {label}
        </span>
        {description && (
          <span
            id={`${id}-description`}
            className="block text-sm text-muted-foreground"
          >
            {description}
          </span>
        )}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
          checked ? "bg-success" : "bg-border",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block size-6 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-7" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}
