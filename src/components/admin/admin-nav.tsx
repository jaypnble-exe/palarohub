"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { DashboardIcon, type IconName } from "./dashboard-icon";

interface Tab {
  key: string;
  icon: IconName;
  href: string;
  /** Sub-paths that also light up this tab. */
  sections: string[];
}

/** Which tab a commissioner page belongs to. */
export function activeTab(pathname: string, slug: string) {
  const base = `/admin/${slug}`;
  if (pathname === base || pathname === `${base}/`) return "home";
  const section = pathname.slice(base.length + 1).split("/")[0];
  for (const tab of tabs(slug))
    if (tab.sections.includes(section)) return tab.key;
  return "more";
}

function tabs(slug: string): Tab[] {
  const base = `/admin/${slug}`;
  return [
    { key: "home", icon: "home", href: base, sections: [] },
    {
      key: "teams",
      icon: "teams",
      href: `${base}/teams`,
      sections: ["teams", "registrations", "players", "ratings"],
    },
    {
      key: "games",
      icon: "games",
      href: `${base}/games`,
      sections: ["games", "schedule"],
    },
    {
      key: "payments",
      icon: "payments",
      href: `${base}/payments`,
      sections: ["payments"],
    },
    {
      key: "more",
      icon: "more",
      href: `${base}/more`,
      sections: ["more", "seasons", "announcements"],
    },
  ];
}

/**
 * The same five places on every commissioner page: a bottom bar on phones,
 * a top bar on wider screens. Icons always come with labels.
 */
export function AdminNav({ slug }: { slug: string }) {
  const t = useTranslations("AdminNav");
  const pathname = usePathname();
  const current = activeTab(pathname, slug);
  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] sm:sticky sm:top-0 sm:mt-4 sm:rounded-2xl sm:border sm:pb-0"
    >
      <ul className="mx-auto grid max-w-4xl grid-cols-5">
        {tabs(slug).map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={current === tab.key ? "page" : undefined}
              className="flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent aria-[current=page]:text-orange-dark sm:flex-row sm:gap-2 sm:text-sm"
            >
              <DashboardIcon name={tab.icon} className="size-6 sm:size-5" />
              <span>{t(tab.key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
