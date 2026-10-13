import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

const alertVariants = cva(
  "flex items-start gap-3 rounded-xl p-4 text-sm font-semibold",
  {
    variants: {
      tone: {
        info: "bg-accent text-foreground",
        success: "bg-success-soft text-success",
        warning: "bg-orange-soft text-orange-dark",
        danger: "bg-destructive-soft text-destructive",
        /** For blocking problems that must be read first. */
        critical: "bg-destructive text-white",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

const icons: Record<string, IconName> = {
  info: "info",
  success: "check",
  warning: "alert",
  danger: "alert",
  critical: "alert",
};

/**
 * A plain-language message. Problems are announced to screen readers
 * immediately (role="alert"); good news and hints politely (role="status").
 */
export function Alert({
  className,
  tone = "info",
  title,
  children,
  action,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof alertVariants> & {
    title?: React.ReactNode;
    action?: React.ReactNode;
  }) {
  const urgent = tone === "danger" || tone === "critical" || tone === "warning";
  return (
    <div
      role={urgent ? "alert" : "status"}
      data-slot="alert"
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon name={icons[tone ?? "info"]} className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-bold">{title}</p>}
        <div className={title ? "font-normal" : undefined}>{children}</div>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}
