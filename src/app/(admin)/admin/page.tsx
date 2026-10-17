import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { platformLeagues, platformOverview } from "@/lib/platform-data";
import { AccessDenied } from "@/components/access-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatTile } from "@/components/ui/stat";

/** The platform admin's home: every league, its people and activity. */
export default async function PlatformAdminPage() {
  const { supabase } = await requireUser("/admin");
  if (!(await isPlatformAdmin())) return <AccessDenied />;
  const [t, sports, format, overview, leagues] = await Promise.all([
    getTranslations("Platform"),
    getTranslations("Sports"),
    getFormatter(),
    platformOverview(supabase),
    platformLeagues(supabase),
  ]);
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium" });
  const commissioner = (league: (typeof leagues)[number]) =>
    league.commissioners
      .map((person) => person.name || person.email)
      .join(", ") || t("noCommissioner");
  const status = (league: (typeof leagues)[number]) => (
    <span className="flex flex-wrap gap-1">
      {league.paused_at && <Badge tone="danger">{t("paused")}</Badge>}
      {league.games_live > 0 && (
        <Badge tone="primary">
          {t("liveCount", { count: league.games_live })}
        </Badge>
      )}
    </span>
  );
  return (
    <main className="mx-auto max-w-5xl space-y-8 py-8">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <>
            <Button asChild>
              <Link href="/admin/new">
                <Icon name="add" className="size-5" />
                {t("createLeague")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/users">
                <Icon name="search" className="size-5" />
                {t("findUser")}
              </Link>
            </Button>
          </>
        }
      />
      <Section id="overview" title={t("overviewTitle")}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            label={t("statLive")}
            value={overview.gamesLive}
            detail={t("statWaiting", { count: overview.gamesWaiting })}
          />
          <StatTile label={t("statWeek")} value={overview.gamesThisWeek} />
          <StatTile
            label={t("statLeagues")}
            value={overview.leagues}
            detail={t("statLeaguesDetail", { count: overview.pausedLeagues })}
          />
          <StatTile label={t("statTeams")} value={overview.teams} />
          <StatTile label={t("statPlayers")} value={overview.players} />
          <StatTile label={t("statUsers")} value={overview.users} />
        </div>
      </Section>
      <Section id="leagues" title={t("leaguesTitle")}>
        {leagues.length === 0 ? (
          <EmptyState
            icon="leagues"
            title={t("leaguesEmpty")}
            description={t("leaguesEmptyHelp")}
          />
        ) : (
          <DataTable
            label={t("leaguesTitle")}
            rows={leagues}
            rowKey={(league) => league.id}
            rowHref={(league) => `/admin/leagues/${league.slug}`}
            rowLabel={(league) => `${t("manage")}: ${league.name}`}
            openLabel={t("manage")}
            columns={[
              {
                key: "league",
                header: t("colLeague"),
                cell: (league) => (
                  <span className="space-y-1">
                    <span className="block font-semibold">{league.name}</span>
                    <span className="block text-muted-foreground">
                      {sports(league.sport)}
                    </span>
                    {status(league)}
                  </span>
                ),
              },
              {
                key: "commissioner",
                header: t("colCommissioner"),
                cell: commissioner,
              },
              {
                key: "season",
                header: t("colSeason"),
                cell: (league) => league.current_season ?? t("noSeason"),
              },
              {
                key: "teams",
                header: t("colTeams"),
                align: "right",
                cell: (league) => league.teams,
              },
              {
                key: "games",
                header: t("colGames"),
                align: "right",
                cell: (league) => league.games_played,
              },
              {
                key: "activity",
                header: t("colActivity"),
                cell: (league) => date(league.last_activity),
              },
            ]}
            phone={(league) => ({
              title: league.name,
              subtitle: (
                <>
                  {commissioner(league)}
                  <br />
                  {t("teamsCount", { count: league.teams })} ·{" "}
                  {t("gamesCount", { count: league.games_played })}
                  <br />
                  {t("lastActivity", { date: date(league.last_activity) })}
                </>
              ),
              trailing: status(league),
            })}
          />
        )}
      </Section>
    </main>
  );
}
