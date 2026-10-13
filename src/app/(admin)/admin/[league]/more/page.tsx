import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { isPlatformAdmin } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
import { TileGrid, type Tile } from "@/components/admin/tile-grid";

/** Everything that is not in the bottom bar, one tap away. */
export default async function MorePage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const t = await getTranslations("AdminMore");
  const base = `/admin/${slug}`;
  const sections: { title: string; tiles: Tile[] }[] = [
    {
      title: t("season"),
      tiles: [
        {
          href: `${base}/seasons`,
          icon: "seasons",
          label: t("seasons"),
          description: t("seasonsHelp"),
        },
        {
          href: `${base}/schedule`,
          icon: "schedule",
          label: t("schedule"),
          description: t("scheduleHelp"),
        },
        {
          href: `${base}/announcements`,
          icon: "announcements",
          label: t("announcements"),
          description: t("announcementsHelp"),
        },
      ],
    },
    {
      title: t("people"),
      tiles: [
        {
          href: `${base}/registrations`,
          icon: "review",
          label: t("registrations"),
          description: t("registrationsHelp"),
        },
        {
          href: `${base}/players`,
          icon: "players",
          label: t("players"),
          description: t("playersHelp"),
        },
        {
          href: `${base}/ratings`,
          icon: "ratings",
          label: t("ratings"),
          description: t("ratingsHelp"),
        },
      ],
    },
    {
      title: t("public"),
      tiles: [
        {
          href: `/${slug}`,
          icon: "public",
          label: t("publicPage"),
          description: t("publicPageHelp"),
        },
        {
          href: `/${slug}/schedule`,
          icon: "schedule",
          label: t("publicSchedule"),
        },
        {
          href: `/${slug}/standings`,
          icon: "standings",
          label: t("standings"),
        },
      ],
    },
    {
      title: t("account"),
      tiles: [
        ...(canManage
          ? [
              {
                href: `/team/${slug}`,
                icon: "workspace" as const,
                label: t("teamWorkspace"),
                description: t("teamWorkspaceHelp"),
              },
            ]
          : []),
        { href: "/leagues", icon: "leagues", label: t("myLeagues") },
        ...((await isPlatformAdmin())
          ? [{ href: "/admin", icon: "add" as const, label: t("newLeague") }]
          : []),
      ],
    },
  ];
  return (
    <main className="space-y-7 py-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-muted-foreground">
          {league.name}
        </p>
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      </div>
      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <TileGrid tiles={section.tiles} />
        </section>
      ))}
    </main>
  );
}
