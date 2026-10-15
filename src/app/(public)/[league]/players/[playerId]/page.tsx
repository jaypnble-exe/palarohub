import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getFormatter, getTranslations } from "next-intl/server";
import { competitionContext, careerGames } from "@/lib/competition-data";
import { aggregateCareer, careerMetricValue } from "@/lib/domain/career-stats";
import { getSportModule } from "@/lib/sports/registry";
import { PageHeader } from "@/components/ui/page-header";
import { cardVariants } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { loadPlayerAwards } from "@/lib/player-awards";
import { PlayerOfGameStats } from "@/components/public/player-of-game";

export default async function CareerPage({
  params,
}: {
  params: Promise<{ league: string; playerId: string }>;
}) {
  const { league: slug, playerId } = await params;
  if (!z.uuid().safeParse(playerId).success) notFound();
  const { supabase, league } = await competitionContext(slug);
  const { games, unreadableGames } = await careerGames(
    supabase,
    league.id,
    undefined,
    playerId,
  );
  if (!games.length) notFound();
  const t = await getTranslations("Competition");
  const awardText = await getTranslations("PlayerOfGame");
  const awards = await loadPlayerAwards(supabase, league.id, { playerId });
  const format = await getFormatter();
  const sports = [...new Set(games.map((game) => game.sport))];
  return (
    <main className="space-y-6 py-6">
      <PageHeader
        back={{ href: `/${slug}/stats`, label: t("stats") }}
        eyebrow={league.name}
        title={games[0].name}
        description={t("careerIntro")}
      />
      {unreadableGames > 0 && (
        <Alert tone="warning">{t("incompleteStats")}</Alert>
      )}
      {awards.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">
            {awardText("careerAwards", { count: awards.length })}
          </h2>
          <ul className="space-y-3">
            {awards.map((award) => {
              const game = games.find((game) => game.gameId === award.game_id);
              return (
                <li key={award.game_id} className={cardVariants()}>
                  <Link
                    href={`/${slug}/games/${award.game_id}`}
                    className="font-semibold text-orange-dark hover:underline"
                  >
                    {game
                      ? t("against", { team: game.opponent })
                      : awardText("viewResult")}
                  </Link>
                  {game && (
                    <p className="mb-3 text-sm text-muted-foreground">
                      {game.seasonName} · {game.divisionName}
                      {game.playedAt
                        ? ` · ${format.dateTime(new Date(game.playedAt), { dateStyle: "medium" })}`
                        : ""}
                    </p>
                  )}
                  <PlayerOfGameStats
                    metrics={award.metrics}
                    efficiency={award.efficiency}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {sports.map((sport) => {
        const history = games.filter((game) => game.sport === sport);
        const row = aggregateCareer(history)[0];
        const sportModule = getSportModule(sport);
        const groups = [
          ...new Set(
            history.map(
              (game) => `${game.seasonId}/${game.divisionId}/${game.teamName}`,
            ),
          ),
        ];
        return (
          <section key={sport} className="space-y-5">
            <h2 className="text-xl font-semibold">
              {t("careerTotals", { games: row.games, wins: row.wins })}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {sportModule.careerMetrics.map((metric) => {
                const value = careerMetricValue(row, metric);
                return (
                  <div
                    key={metric.labelKey}
                    className={cardVariants({ padding: "sm" })}
                  >
                    <p className="text-sm text-muted-foreground">
                      {t(`metric.${metric.labelKey}`)}
                    </p>
                    <p className="font-display text-3xl font-semibold tabular-nums">
                      {value === null
                        ? t("noValue")
                        : format.number(value, { maximumFractionDigits: 1 })}
                      {metric.denominator && value !== null ? t("percent") : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metric.denominator
                        ? t("shootingAccuracy")
                        : t("perGame")}
                    </p>
                  </div>
                );
              })}
            </div>
            <h2 className="font-display text-2xl font-semibold">
              {t("seasonHistory")}
            </h2>
            <ul className="space-y-3">
              {groups.map((key) => {
                const entries = history.filter(
                  (game) =>
                    `${game.seasonId}/${game.divisionId}/${game.teamName}` ===
                    key,
                );
                const total = aggregateCareer(entries)[0];
                return (
                  <li key={key} className={cardVariants()}>
                    <Link
                      href={`/${slug}/stats?season=${entries[0].seasonId}`}
                      className="font-semibold text-orange-dark hover:underline"
                    >
                      {entries[0].seasonName} · {entries[0].divisionName}
                    </Link>
                    <p>{entries[0].teamName}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("careerTotals", {
                        games: total.games,
                        wins: total.wins,
                      })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      {sportModule.careerMetrics.slice(0, 5).map((metric) => (
                        <span key={metric.key}>
                          {t("metricTotal", {
                            metric: t(`metric.${metric.labelKey}`),
                            value: format.number(
                              total.metrics[metric.key] ?? 0,
                              { maximumFractionDigits: 1 },
                            ),
                          })}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
            <h2 className="font-display text-2xl font-semibold">
              {t("recentGames")}
            </h2>
            <ul className="divide-y rounded-2xl border bg-card px-4">
              {history.slice(0, 50).map((game) => (
                <li
                  key={game.gameId}
                  className="flex flex-wrap justify-between gap-2 py-3"
                >
                  <div>
                    <Link
                      href={`/${slug}/games/${game.gameId}`}
                      className="font-semibold text-orange-dark hover:underline"
                    >
                      {t("against", { team: game.opponent })}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {game.divisionName} ·{" "}
                      {game.playedAt
                        ? format.dateTime(new Date(game.playedAt), {
                            dateStyle: "medium",
                          })
                        : t("noDate")}
                    </p>
                  </div>
                  <span
                    className={
                      game.won
                        ? "font-semibold text-success"
                        : "text-muted-foreground"
                    }
                  >
                    {t(game.won ? "win" : "loss")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
