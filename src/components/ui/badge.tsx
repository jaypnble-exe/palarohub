import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-accent text-foreground",
        success: "bg-success text-white",
        warning: "bg-orange-soft text-orange-dark",
        danger: "bg-destructive-soft text-destructive",
        dark: "bg-navy-secondary text-on-dark-muted",
        primary: "bg-primary text-white",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/** Short status labels: "Paid in full", "Postponed", "Penalty". */
export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  );
}
