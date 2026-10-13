import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { cardVariants } from "./card";
import { Icon } from "./icon";

export interface DataColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

/**
 * A list of records that is a real table on wider screens and a stack of
 * two-line rows on phones, so nothing scrolls sideways. Each row can open
 * a detail page.
 */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  rowHref,
  rowLabel,
  phone,
  openLabel,
}: {
  label: string;
  columns: readonly DataColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  /** The accessible name of a row's link, e.g. the team's name. */
  rowLabel?: (row: T) => string;
  /** How a row reads on a phone. */
  phone: (row: T) => {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    trailing?: React.ReactNode;
  };
  /** Text of the last column's link on wider screens. */
  openLabel?: string;
}) {
  return (
    <div className={cn(cardVariants({ padding: "none" }), "overflow-hidden")}>
      <ul className="divide-y sm:hidden" aria-label={label}>
        {rows.map((row) => {
          const view = phone(row);
          const body = (
            <>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block truncate font-semibold">
                  {view.title}
                </span>
                {view.subtitle && (
                  <span className="block text-sm text-muted-foreground">
                    {view.subtitle}
                  </span>
                )}
              </span>
              {view.trailing && (
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {view.trailing}
                </span>
              )}
              {rowHref && (
                <Icon
                  name="arrow"
                  className="size-5 shrink-0 text-muted-foreground"
                />
              )}
            </>
          );
          return (
            <li key={rowKey(row)}>
              {rowHref ? (
                <Link
                  href={rowHref(row)}
                  aria-label={rowLabel?.(row)}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <table className="hidden w-full text-sm sm:table" aria-label={label}>
        <thead>
          <tr className="border-b bg-accent/40 text-left text-muted-foreground">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 font-semibold",
                  column.align === "right" && "text-right",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
            {rowHref && (
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">{openLabel}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="transition-colors hover:bg-accent/40"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 py-3 align-middle",
                    column.align === "right" && "text-right tabular-nums",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
              {rowHref && (
                <td className="px-4 py-3 text-right">
                  <Link
                    href={rowHref(row)}
                    aria-label={rowLabel?.(row)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-semibold text-orange-dark hover:underline"
                  >
                    {openLabel}
                    <Icon name="arrow" className="size-4" />
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
