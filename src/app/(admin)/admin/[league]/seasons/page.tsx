import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { riyadhToday, seasonPhase } from "@/lib/domain/season-phase";
import { registrationState } from "@/lib/domain/registration-window";
import { AccessDenied } from "@/components/access-denied";
import { SeasonCard, type AdminSeason } from "@/components/admin/season-card";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LinkCard } from "@/components/ui/link-card";
import { PageHeader } from "@/components/ui/page-header";

/** Every season of the league: what is running now, what is next, and history. */
export default async function SeasonsPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const [seasons, settings, registrations, games, closures] = await Promise.all(
    [
      supabase
        .from("seasons")
        .select("id,name,status,start_date,end_date,divisions(name,max_rating)")
        .eq("league_id", league.id)
        .order("start_date", { ascending: false }),
      supabase
        .from("registration_settings")
        .select("season_id,is_open,deadline")
        .eq("league_id", league.id),
      supabase
        .from("season_teams")
        .select("season_id,status")
        .eq("league_id", league.id),
      supabase
        .from("games")
        .select("season_id,status")
        .eq("league_id", league.id)
        .neq("status", "cancelled"),
      supabase
        .from("season_closures")
        .select("season_id")
        .eq("league_id", league.id),
    ],
  );
  if (
    seasons.error ||
    settings.error ||
    registrations.error ||
    games.error ||
    closures.error
  )
    throw new Error("Unable to load seasons.");
  const t = await getTranslations("Seasons");
  const now = new Date();
  const today = riyadhToday(now);
  const cards: AdminSeason[] = seasons.data.map((season) => {
    const setting = settings.data.find((row) => row.season_id === season.id);
    const teams = registrations.data.filter(
      (row) => row.season_id === season.id,
    );
    const seasonGames = games.data.filter((row) => row.season_id === season.id);
    return {
      ...season,
      divisions: [...season.divisions].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      phase: seasonPhase(
        season,
        today,
        closures.data.some((row) => row.season_id === season.id),
      ),
      registration: registrationState(
        setting
          ? { isOpen: setting.is_open, deadline: setting.deadline }
          : null,
        now,
      ),
      deadline: setting?.deadline,
      teams: teams.filter((row) => row.status === "approved").length,
      waiting: teams.filter((row) => row.status === "submitted").length,
      games: seasonGames.length,
      gamesPlayed: seasonGames.filter((row) => row.status === "approved")
        .length,
    };
  });
  const done = (season: AdminSeason) =>
    season.phase === "finished" || season.phase === "closed";
  const current = cards.filter((season) => !done(season));
  const past = cards.filter(done);
  const create = canManage && (
    <Button asChild>
      <Link href={`/admin/${slug}/seasons/new`}>
        <Icon name="add" className="size-5" />
        {t("create")}
      </Link>
    </Button>
  );
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{ href: `/admin/${slug}`, label: t("leagueHome") }}
        eyebrow={league.name}
        title={t("title")}
        description={t("intro")}
        actions={cards.length ? create : undefined}
      />
      {!cards.length ? (
        <EmptyState
          icon="seasons"
          title={t("empty")}
          description={t("emptyHelp")}
          action={create || undefined}
        />
      ) : (
        <>
          {current.length > 0 && (
            <section className="space-y-3" aria-labelledby="current-seasons">
              <h2
                id="current-seasons"
                className="text-sm font-bold tracking-wide text-muted-foreground uppercase"
              >
                {t("currentSeasons")}
              </h2>
              <ul className="space-y-4">
                {current.map((season) => (
                  <SeasonCard
                    key={season.id}
                    slug={slug}
                    season={season}
                    today={today}
                  />
                ))}
              </ul>
            </section>
          )}
          {past.length > 0 && (
            <details className={cardVariants()} open={!current.length}>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                {t("pastSeasons", { count: past.length })}
              </summary>
              <ul className="space-y-4 pt-3">
                {past.map((season) => (
                  <SeasonCard
                    key={season.id}
                    slug={slug}
                    season={season}
                    today={today}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      <LinkCard
        href={`/admin/${slug}/ratings`}
        title={t("ratingScale")}
        subtitle={t("ratingScaleHelp")}
      />
    </main>
  );
}
