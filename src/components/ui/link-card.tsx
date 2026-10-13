import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { cardVariants } from "./card";
import { Icon } from "./icon";

/** A whole-row link: title, a quieter line below, and a status on the right. */
export function LinkCard({
  href,
  title,
  subtitle,
  trailing,
  tone = "default",
  className,
}: {
  href: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  tone?: "default" | "navy";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        cardVariants({ tone, interactive: true }),
        "flex items-center gap-3",
        className,
      )}
    >
      {/* Text and status share a row when there is room; the status wraps below on narrow phones. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-[12rem] flex-1">
          <span className="block font-semibold leading-snug">{title}</span>
          {subtitle && (
            <span
              className={cn(
                "block text-sm",
                tone === "navy"
                  ? "text-on-dark-muted"
                  : "text-muted-foreground",
              )}
            >
              {subtitle}
            </span>
          )}
        </span>
        {trailing}
      </span>
      <Icon
        name="arrow"
        className={cn(
          "size-5 shrink-0",
          tone === "navy" ? "text-on-dark-muted" : "text-muted-foreground",
        )}
      />
    </Link>
  );
}
