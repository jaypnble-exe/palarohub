import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/**
 * The top of every screen: an optional way back, a small context line
 * (league, season), the title, a short explanation, and page actions.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  back,
  actions,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {back && (
        <Link
          href={back.href}
          className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Icon name="back" className="size-5" />
          {back.label}
        </Link>
      )}
      <div className="space-y-2">
        {eyebrow && (
          <p className="text-sm font-semibold text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="break-words font-display text-3xl font-semibold tracking-wide sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-prose text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
