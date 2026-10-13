"use client";
import { useTranslations } from "next-intl";
import { AppNav, type NavTab } from "@/components/ui/app-nav";

/** Home · Games · Payments · League, on every team manager page. */
export function TeamNav({ slug }: { slug: string }) {
  const t = useTranslations("TeamNav");
  const base = `/team/${slug}`;
  const tabs: NavTab[] = [
    {
      key: "home",
      label: t("home"),
      icon: "home",
      href: base,
      sections: ["registrations", "register"],
    },
    {
      key: "games",
      label: t("games"),
      icon: "games",
      href: `${base}/games`,
      sections: ["games"],
    },
    {
      key: "payments",
      label: t("payments"),
      icon: "payments",
      href: `${base}/payments`,
      sections: ["payments"],
    },
    { key: "league", label: t("league"), icon: "public", href: `/${slug}` },
  ];
  return <AppNav label={t("label")} base={base} tabs={tabs} fallback="home" />;
}
