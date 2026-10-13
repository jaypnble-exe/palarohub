import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** A titled block of a page, with an optional link on the right ("Full schedule"). */
export function Section({
  id,
  title,
  description,
  action,
  children,
  className,
  headingLevel = 2,
}: {
  /** Used for the heading id so the section is labelled for screen readers. */
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: { href: string; label: string } | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const link =
    action && typeof action === "object" && "href" in action ? (
      <Link
        href={action.href}
        className="inline-flex min-h-11 items-center font-semibold text-orange-dark hover:underline"
      >
        {action.label}
      </Link>
    ) : (
      action
    );
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={cn("space-y-3", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <Heading
          id={`${id}-heading`}
          className={
            headingLevel === 2
              ? "font-display text-2xl font-semibold"
              : "text-lg font-semibold"
          }
        >
          {title}
        </Heading>
        {link}
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {children}
    </section>
  );
}
