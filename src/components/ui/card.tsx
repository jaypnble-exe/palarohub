import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Surfaces: use `cardVariants` directly when an element must stay a <p>, <li>, <a>… */
export const cardVariants = cva("rounded-2xl", {
  variants: {
    tone: {
      default: "border border-border bg-card",
      muted: "bg-accent",
      navy: "bg-navy text-on-dark",
      highlight: "border-2 border-navy bg-card",
      warning: "border border-primary/30 bg-orange-soft text-orange-dark",
      danger: "border-2 border-destructive bg-card",
    },
    padding: { none: "", sm: "p-3", md: "p-4 sm:p-5", lg: "p-5 sm:p-7" },
    interactive: {
      true: "transition-colors hover:bg-accent",
      false: "",
    },
  },
  compoundVariants: [
    { tone: "navy", interactive: true, class: "hover:bg-navy-secondary" },
  ],
  defaultVariants: { tone: "default", padding: "md", interactive: false },
});

export function Card({
  className,
  tone,
  padding,
  interactive,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof cardVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "div";
  return (
    <Component
      data-slot="card"
      className={cn(cardVariants({ tone, padding, interactive }), className)}
      {...props}
    />
  );
}
