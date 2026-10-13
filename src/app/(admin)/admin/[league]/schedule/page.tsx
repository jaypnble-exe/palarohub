import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { scheduleOverview, type DivisionOverview } from "@/lib/schedule-data";
import { liveScores } from "@/lib/live-scores";
import { riyadhToday } from "@/lib/domain/season-phase";
import { AccessDenied } from "@/components/access-denied";
import { LiveGameCard } from "@/components/schedule/live-game-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

/** What is being played now, what is next, and each division's schedule. */
export default async function ScheduleHome({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const now = new Date();
  const [divisions, live, upcoming] = await Promise.all([
    scheduleOverview(supabase, league.id),
    supabase
      .from("published_games")
      .select(
        "id,round,scheduled_at,venue,division_name,home_team_name,away_team_name",
      )
      .eq("league_id", league.id)
      .eq("status", "in_progress")
      .order("scheduled_at"),
    supabase
      .from("published_games")
      .select(
        "id,round,scheduled_at,venue,division_id,division_name,home_team_name,away_team_name",
      )
      .eq("league_id", league.id)
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .order("scheduled_at")
      .limit(6),
  ]);
  if (live.error || upcoming.error) throw new Error("Unable to load games.");
  const scores = await liveScores(
    supabase,
    league.id,
    live.data.map((game) => game.id ?? "").filter(Boolean),
  );
  const t = await getTranslations("Schedule");
  const format = await getFormatter();
  const seasons = [...new Set(divisions.map((division) => division.seasonId))];
  const toApprove = divisions.reduce(
    (sum, division) => sum + division.toApproveCount,
    0,
  );
  const today = riyadhToday(now);
  const tomorrow = riyadhToday(new Date(now.getTime() + 86400000));
  const dayLabel = (iso: string) => {
    const day = riyadhToday(new Date(iso));
    return day === today
      ? t("today")
      : day === tomorrow
        ? t("tomorrow")
        : format.dateTime(new Date(iso), {
            weekday: "long",
            day: "numeric",
            month: "short",
          });
  };
  const days = [
    ...new Set(upcoming.data.map((game) => dayLabel(game.scheduled_at!))),
  ];

  return (
    <main className="mx-auto max-w-2xl space-y-8 py-6">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11 py-2">
              <Link href={`/${slug}/schedule`}>
                <Icon name="public" className="size-5" />
                {t("publicSchedule")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 py-2">
              <Link href={`/admin/${slug}/announcements`}>
                <Icon name="announcements" className="size-5" />
                {t("announcements")}
              </Link>
            </Button>
          </>
        }
      />

      {toApprove > 0 && (
        <Alert
          tone="warning"
          title={t("resultsToApprove", { count: toApprove })}
          action={
            <Button asChild variant="outline" className="min-h-11 py-2">
              <Link href={`/admin/${slug}/games`}>{t("reviewResults")}</Link>
            </Button>
          }
        >
          {t("resultsToApproveHelp")}
        </Alert>
      )}

      {live.data.length > 0 && (
        <section className="space-y-3" aria-labelledby="live-now">
          <h2
            id="live-now"
            className="flex items-center gap-2 font-display text-2xl font-semibold"
          >
            <span
              className="size-3 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
              aria-hidden="true"
            />
            {t("liveNow")}
          </h2>
          <ul className="space-y-3">
            {live.data.map((game) => (
              <LiveGameCard
                key={game.id}
                href={`/admin/${slug}/games/${game.id}`}
                game={{
                  homeName: game.home_team_name ?? "",
                  awayName: game.away_team_name ?? "",
                  divisionName: game.division_name ?? "",
                  round: game.round,
                  venue: game.venue ?? "",
                }}
                score={game.id ? scores.get(game.id) : undefined}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="coming-up">
        <h2 id="coming-up" className="font-display text-2xl font-semibold">
          {t("comingUp")}
        </h2>
        {!upcoming.data.length ? (
          <EmptyState icon="schedule" title={t("nothingScheduled")} />
        ) : (
          <div className="space-y-4">
            {days.map((day) => (
              <div key={day} className="space-y-2">
                <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                  {day}
                </h3>
                <ul
                  className={cn(cardVariants({ padding: "none" }), "divide-y")}
                >
                  {upcoming.data
                    .filter((game) => dayLabel(game.scheduled_at!) === day)
                    .map((game) => (
                      <li key={game.id}>
                        <Link
                          href={`/admin/${slug}/games/${game.id}`}
                          className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent"
                        >
                          <span className="w-16 shrink-0 font-display text-xl font-semibold">
                            {format.dateTime(new Date(game.scheduled_at!), {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {t("versus", {
                                home: game.home_team_name ?? "",
                                away: game.away_team_name ?? "",
                              })}
                            </span>
                            <span className="block truncate text-sm text-muted-foreground">
                              {[game.division_name, game.venue]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <Icon
                            name="arrow"
                            className="size-5 shrink-0 text-muted-foreground"
                          />
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="divisions-title">
        <h2
          id="divisions-title"
          className="font-display text-2xl font-semibold"
        >
          {t("byDivision")}
        </h2>
        {!seasons.length && (
          <EmptyState icon="seasons" title={t("noSeasons")} />
        )}
        {seasons.map((seasonId) => {
          const seasonDivisions = divisions.filter(
            (division) => division.seasonId === seasonId,
          );
          return (
            <div key={seasonId} className="space-y-3">
              {seasons.length > 1 && (
                <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                  {seasonDivisions[0]?.seasonName}
                </h3>
              )}
              <ul className="grid gap-3 sm:grid-cols-2">
                {seasonDivisions.map((division) => (
                  <DivisionCard
                    key={division.id}
                    slug={slug}
                    division={division}
                    nextLabel={
                      division.nextAt
                        ? `${dayLabel(division.nextAt)}, ${format.dateTime(
                            new Date(division.nextAt),
                            { hour: "numeric", minute: "2-digit" },
                          )}`
                        : undefined
                    }
                    t={t}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function DivisionCard({
  slug,
  division,
  nextLabel,
  t,
}: {
  slug: string;
  division: DivisionOverview;
  nextLabel?: string;
  t: Awaited<ReturnType<typeof getTranslations<"Schedule">>>;
}) {
  const scheduled = division.gameCount > 0;
  return (
    <li className={cn(cardVariants(), "flex flex-col gap-3")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{division.name}</h3>
          <p className="text-sm text-muted-foreground">
            {t("teamCount", { count: division.teamCount })}
            {scheduled && ` · ${t("gameCount", { count: division.gameCount })}`}
          </p>
        </div>
        {division.liveCount > 0 && (
          <Badge tone="primary">{t("liveBadge")}</Badge>
        )}
      </div>
      {scheduled && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">
            {t("playedOf", {
              played: division.playedCount,
              total: division.gameCount,
            })}
          </p>
          <Progress
            value={division.playedCount}
            max={division.gameCount}
            label={t("playedOf", {
              played: division.playedCount,
              total: division.gameCount,
            })}
          />
          {nextLabel && (
            <p className="text-sm text-muted-foreground">
              {t("nextGame", { when: nextLabel })}
            </p>
          )}
        </div>
      )}
      <div className="mt-auto pt-1">
        {scheduled ? (
          <Button asChild variant="outline" className="w-full">
            <Link href={`/admin/${slug}/schedule/${division.id}`}>
              {t("viewSchedule")}
            </Link>
          </Button>
        ) : division.teamCount >= 2 ? (
          <Button asChild className="w-full">
            <Link href={`/admin/${slug}/schedule/${division.id}/new`}>
              <Icon name="add" className="size-5" />
              {t("makeSchedule")}
            </Link>
          </Button>
        ) : (
          <p className="rounded-xl bg-accent p-3 text-sm">
            {t("needTwoTeams")}
          </p>
        )}
      </div>
    </li>
  );
}
