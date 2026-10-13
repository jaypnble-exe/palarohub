"use client";
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const chipClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-border bg-background px-4 font-semibold transition-colors hover:border-navy aria-pressed:border-navy aria-pressed:bg-navy aria-pressed:text-on-dark aria-[current=page]:border-navy aria-[current=page]:bg-navy aria-[current=page]:text-on-dark disabled:opacity-50";

/** A tap-to-choose toggle. Prefer chips over dropdowns for short lists. */
export function Chip({
  selected,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(chipClass, className)}
      {...props}
    />
  );
}

/**
 * A labelled row of chips. Single choice by default; `multiple` lets
 * several be picked (e.g. game days).
 */
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
  stretch = false,
  className,
}: {
  label: string;
  options: readonly { value: T; label: React.ReactNode }[];
  value: T | readonly T[];
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Fill the row evenly, e.g. a two-way switch. */
  stretch?: boolean;
  className?: string;
}) {
  const selected = (option: T) =>
    Array.isArray(value) ? value.includes(option) : value === option;
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => (
        <Chip
          key={String(option.value)}
          selected={selected(option.value)}
          disabled={disabled}
          className={stretch ? "flex-1" : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

/** Filter links that look like chips (season, division). */
export function ChipLinks({
  label,
  links,
}: {
  label: string;
  links: readonly { href: string; label: React.ReactNode; current: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.current ? "page" : undefined}
          className={chipClass}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** A big radio choice with a title and an explanation. */
export function ChoiceCard({
  name,
  checked,
  onChange,
  title,
  description,
  badge,
  disabled = false,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A short tag after the title, e.g. "Already entered". */
  badge?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 items-start gap-3 rounded-2xl border-2 border-border bg-card p-4 transition-colors has-[:checked]:border-navy has-[:checked]:bg-accent/40",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-navy",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-1 size-5 shrink-0 accent-primary"
      />
      <span className="min-w-0 space-y-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {title}
          {badge}
        </span>
        {description && (
          <span className="block text-sm text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
