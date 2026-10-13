import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { cardVariants } from "./card";

/** A thin progress bar with an accessible value. */
export function Progress({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-2 overflow-hidden rounded-full bg-accent", className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** One headline number, e.g. "Games played 6 of 12", optionally a link. */
export function StatTile({
  label,
  value,
  detail,
  progress,
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  progress?: { value: number; max: number };
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <span className="block text-sm font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="block font-display text-3xl font-semibold leading-tight">
        {value}
      </span>
      {detail && (
        <span className="block text-sm text-muted-foreground">{detail}</span>
      )}
      {progress && (
        <Progress
          value={progress.value}
          max={progress.max}
          label={label}
          className="mt-2"
        />
      )}
    </>
  );
  const classes = cn(
    cardVariants({ interactive: Boolean(href) }),
    "block space-y-1",
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

/** The square number in front of a to-do item. */
export function CountBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-xl bg-orange-soft font-display text-2xl font-semibold text-orange-dark",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
