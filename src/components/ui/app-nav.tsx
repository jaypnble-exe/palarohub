"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

export interface NavTab {
  key: string;
  label: string;
  icon: IconName;
  href: string;
  /** First path segments after `base` that also light up this tab. */
  sections?: readonly string[];
}

/**
 * Which tab a page belongs to: the first tab for `base` itself, a tab whose
 * section matches, otherwise `fallback` (e.g. "More").
 */
export function activeNavTab(
  pathname: string,
  base: string,
  tabs: readonly Pick<NavTab, "key" | "sections">[],
  fallback: string,
) {
  if (pathname === base || pathname === `${base}/`) return tabs[0]?.key;
  if (!pathname.startsWith(`${base}/`)) return fallback;
  const section = pathname.slice(base.length + 1).split("/")[0];
  return tabs.find((tab) => tab.sections?.includes(section))?.key ?? fallback;
}

/**
 * The same few places on every page of an area: a bottom bar on phones,
 * a top bar on wider screens. Icons always come with labels.
 */
export function AppNav({
  label,
  base,
  tabs,
  fallback,
}: {
  label: string;
  base: string;
  tabs: readonly NavTab[];
  /** Tab to light up for pages that belong to no other tab. */
  fallback: string;
}) {
  const current = activeNavTab(usePathname(), base, tabs, fallback);
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] sm:sticky sm:top-0 sm:mt-4 sm:rounded-2xl sm:border sm:pb-0"
    >
      <ul
        className={cn(
          "mx-auto grid max-w-4xl",
          tabs.length === 4 ? "grid-cols-4" : "grid-cols-5",
        )}
      >
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={current === tab.key ? "page" : undefined}
              className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent aria-[current=page]:text-orange-dark sm:flex-row sm:gap-2 sm:text-sm"
            >
              <Icon name={tab.icon} className="size-6 sm:size-5" />
              <span>{tab.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
