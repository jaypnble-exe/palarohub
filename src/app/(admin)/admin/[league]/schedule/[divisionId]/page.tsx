import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { getSiteUrl } from "@/lib/auth";
import { divisionSchedule, type ScheduleGame } from "@/lib/schedule-data";
import { liveScores } from "@/lib/live-scores";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/share-buttons";
import { GameList } from "@/components/schedule/game-list";
import { GameEditor } from "@/components/schedule/game-editor";
import { AddGameForm } from "@/components/schedule/add-game-form";
import { ScorerAccess } from "@/components/schedule/scorer-access";
import { LiveGameCard } from "@/components/schedule/live-game-card";
import {
  canBeScored,
  isSchedulable,
  type GameStatus,
} from "@/lib/validation/schedule";
import { cardVariants } from "@/components/ui/card";
import { ChipLinks } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

const filters = ["upcoming", "results", "all"] as const;
type Filter = (typeof filters)[number];
const inFilter: Record<Filter, (game: ScheduleGame) => boolean> = {
  upcoming: (game) =>
    game.status === "scheduled" || game.status === "postponed",
  results: (game) => game.status === "submitted" || game.status === "approved",
  all: (game) => game.status !== "in_progress",
};

/** One division: games being played, then the schedule and results. */
export default async function DivisionSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string; divisionId: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { league: slug, divisionId } = await params;
  const { show } = await searchParams;
  if (!z.uuid().safeParse(divisionId).success) notFound();
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const schedule = await divisionSchedule(supabase, league.id, divisionId);
  if (!schedule) notFound();
  const { division, teams, games } = schedule;
  const t = await getTranslations("Schedule");
  const scorer = await getTranslations("Scorer");
  const siteUrl = getSiteUrl();
  const now = new Date();
  const publicUrl = `${siteUrl}/${slug}/schedule?division=${division.id}`;
  const live = games.filter((game) => game.status === "in_progress");
  const scores = await liveScores(
    supabase,
    league.id,
    live.map((game) => game.id),
  );
  const filter: Filter = filters.find((item) => item === show) ?? "upcoming";
  const shown = games.filter(inFilter[filter]);
  const counted = games.filter((game) => game.status !== "cancelled");
  const played = counted.filter((game) => game.status === "approved").length;
  const base = `/admin/${slug}/schedule/${division.id}`;
  // A PIN lasts 24 hours, so scoring is offered from the day before the game.
  const soon = (game: ScheduleGame) =>
    !game.scheduledAt ||
    new Date(game.scheduledAt).getTime() - now.getTime() < 86400000;
  const scoring = (game: ScheduleGame, dark = false) => (
    <ScorerAccess slug={slug} gameId={game.id} siteUrl={siteUrl} dark={dark} />
  );

  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{ href: `/admin/${slug}/schedule`, label: t("backToSchedules") }}
        eyebrow={division.seasons?.name}
        title={division.name}
        description={
          <>
            {t("teamCount", { count: teams.length })}
            {" · "}
            {t("gameCount", { count: counted.length })}
          </>
        }
      />

      {counted.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">
            {t("playedOf", { played, total: counted.length })}
          </p>
          <Progress
            value={played}
            max={counted.length}
            label={t("playedOf", { played, total: counted.length })}
          />
        </div>
      )}

      {live.length > 0 && (
        <section className="space-y-3" aria-labelledby="division-live">
          <h2
            id="division-live"
            className="flex items-center gap-2 font-display text-2xl font-semibold"
          >
            <span
              className="size-3 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
              aria-hidden="true"
            />
            {t("liveNow")}
          </h2>
          <ul className="space-y-3">
            {live.map((game) => (
              <LiveGameCard
                key={game.id}
                href={`/admin/${slug}/games/${game.id}`}
                game={{
                  homeName: game.homeName,
                  awayName: game.awayName,
                  divisionName: division.name,
                  round: game.round,
                  venue: game.venue,
                }}
                score={scores.get(game.id)}
              >
                {scoring(game, true)}
              </LiveGameCard>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="division-games">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="division-games"
            className="font-display text-2xl font-semibold"
          >
            {t("games")}
          </h2>
          {teams.length >= 2 && (
            <Button asChild variant="outline" className="min-h-11 py-2">
              <Link href={`${base}/new`}>
                {t(games.length ? "remakeSchedule" : "makeSchedule")}
              </Link>
            </Button>
          )}
        </div>
        {games.length > 0 && (
          <ChipLinks
            label={t("showGames")}
            links={filters.map((item) => ({
              href: item === "upcoming" ? base : `${base}?show=${item}`,
              label: t(`filter.${item}`, {
                count: games.filter(inFilter[item]).length,
              }),
              current: item === filter,
            }))}
          />
        )}
        <GameList
          games={shown}
          emptyTitle={t(`noneIn.${filter}`)}
          actions={(game) => (
            <>
              {canBeScored(game.status) || isSchedulable(game.status) ? (
                <div className="space-y-3 border-t pt-3">
                  {canBeScored(game.status) &&
                    (soon(game) ? (
                      scoring(game)
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("scoringOpensSoon")}
                      </p>
                    ))}
                  {isSchedulable(game.status) && (
                    <GameEditor
                      slug={slug}
                      game={{ ...game, status: game.status as GameStatus }}
                    />
                  )}
                </div>
              ) : game.status === "submitted" || game.status === "approved" ? (
                <Link
                  href={`/admin/${slug}/games/${game.id}`}
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-orange-dark hover:underline"
                >
                  {t(
                    game.status === "submitted" ? "reviewResult" : "viewResult",
                  )}
                  <Icon name="arrow" className="size-4" />
                </Link>
              ) : null}
              {game.status !== "cancelled" &&
                (!canBeScored(game.status) || !soon(game)) && (
                  <Button asChild variant="outline" className="mt-3">
                    <a
                      href={`/tv/${game.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="live" className="size-4" />
                      {scorer("openTv")}
                    </a>
                  </Button>
                )}
            </>
          )}
        />
      </section>

      {teams.length >= 2 && (
        <AddGameForm
          slug={slug}
          divisionId={division.id}
          teams={teams}
          defaultVenue={games.find((game) => game.venue)?.venue ?? ""}
        />
      )}
      {games.length > 0 && (
        <section className={cn(cardVariants(), "space-y-3")}>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t("shareSchedule")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("shareScheduleHelp")}
            </p>
          </div>
          <ShareButtons
            url={publicUrl}
            text={t("shareText", { division: division.name })}
          />
        </section>
      )}
    </main>
  );
}
