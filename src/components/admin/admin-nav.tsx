"use client";
import { useTranslations } from "next-intl";
import { AppNav, activeNavTab, type NavTab } from "@/components/ui/app-nav";

function tabs(slug: string, label: (key: string) => string): NavTab[] {
  const base = `/admin/${slug}`;
  return [
    { key: "home", label: label("home"), icon: "home", href: base },
    {
      key: "teams",
      label: label("teams"),
      icon: "teams",
      href: `${base}/teams`,
      sections: ["teams", "registrations", "players", "ratings"],
    },
    {
      key: "games",
      label: label("games"),
      icon: "games",
      href: `${base}/games`,
      sections: ["games", "schedule"],
    },
    {
      key: "payments",
      label: label("payments"),
      icon: "payments",
      href: `${base}/payments`,
      sections: ["payments"],
    },
    {
      key: "more",
      label: label("more"),
      icon: "more",
      href: `${base}/more`,
      sections: ["more", "seasons", "announcements"],
    },
  ];
}

/** Which commissioner tab a page belongs to. */
export function activeTab(pathname: string, slug: string) {
  return activeNavTab(pathname, `/admin/${slug}`, tabs(slug, String), "more");
}

/** Home · Teams · Games · Payments · More, on every commissioner page. */
export function AdminNav({ slug }: { slug: string }) {
  const t = useTranslations("AdminNav");
  return (
    <AppNav
      label={t("label")}
      base={`/admin/${slug}`}
      tabs={tabs(slug, (key) => t(key))}
      fallback="more"
    />
  );
}
