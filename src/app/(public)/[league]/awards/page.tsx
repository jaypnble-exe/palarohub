import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  competitionContext,
  careerGames,
  bracketData,
} from "@/lib/competition-data";
import { aggregateCareer, statisticalLeaders } from "@/lib/domain/career-stats";
import { getSportModule } from "@/lib/sports/registry";
import { CompetitionHeader } from "@/components/public/competition-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { cardVariants } from "@/components/ui/card";

export default async function AwardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { league: slug } = await params;
  const query = await searchParams;
  const { supabase, league, seasons } = await competitionContext(slug);
  const season = seasons.find((s) => s.id === query.season) ?? seasons[0];
  const t = await getTranslations("Competition");
  const format = await getFormatter();
  const [career, brackets] = season
    ? await Promise.all([
        careerGames(supabase, league.id, season.id),
        bracketData(supabase, league.id, season.id),
      ])
    : [
        { games: [], unreadableGames: 0 },
        { brackets: [], slots: [], games: [], teams: [] },
      ];
  return (
    <main className="space-y-6 py-6">
      <CompetitionHeader
        slug={slug}
        leagueName={league.name}
        section="awards"
        season={season}
        seasons={seasons}
      />
      {career.unreadableGames > 0 && (
        <Alert tone="warning">{t("incompleteStats")}</Alert>
      )}
      <p className="text-sm text-muted-foreground">{t("awardRules")}</p>
      {season ? (
        season.divisions.map((division) => {
          const rows = aggregateCareer(
            career.games.filter((game) => game.divisionId === division.id),
          );
          const games = brackets.games.filter(
            (game) =>
              game.division_id === division.id && game.status !== "cancelled",
          );
          const slots = brackets.slots.filter(
            (slot) => slot.division_id === division.id,
          );
          const final = slots.find(
            (slot) =>
              slot.round_no === Math.max(...slots.map((s) => s.round_no)),
          );
          const complete =
            career.unreadableGames === 0 &&
            games.length > 0 &&
            games.every((game) => game.status === "approved") &&
            (!slots.length || Boolean(final?.winner_id));
          const awards = getSportModule(division.sport)
            .statisticalAwards.map((award) => ({
              ...award,
              winners: statisticalLeaders(rows, award.key),
            }))
            .filter((award) => award.winners.length);
          return (
            <section key={division.id} className="space-y-3">
              <h2 className="font-display text-2xl font-semibold">
                {division.name}
              </h2>
              <p className="font-semibold text-muted-foreground">
                {t(complete ? "finalLeaders" : "currentLeaders")}
              </p>
              {final?.winner_id && (
                <p className="rounded-xl bg-success-soft p-4 font-semibold text-success">
                  {t("champion", {
                    team:
                      brackets.teams.find((team) => team.id === final.winner_id)
                        ?.team_name ?? t("teamUnknown"),
                  })}
                </p>
              )}
              {awards.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {awards.map((award) => (
                    <article key={award.key} className={cardVariants()}>
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {t(`award.${award.labelKey}`)}
                      </h3>
                      <p className="my-2 font-display text-4xl font-bold tabular-nums">
                        {format.number(award.winners[0].metrics[award.key], {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                      <ul className="space-y-1">
                        {award.winners.map((winner) => (
                          <li key={winner.playerId}>
                            <Link
                              className="inline-flex min-h-11 items-center font-semibold text-orange-dark hover:underline"
                              href={`/${slug}/players/${winner.playerId}`}
                            >
                              {winner.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {t("gamesPlayed", { count: winner.games })}
                            </p>
                          </li>
                        ))}
                      </ul>
                      {award.winners.length > 1 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t("sharedAward")}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title={t("noAwards")} />
              )}
            </section>
          );
        })
      ) : (
        <EmptyState title={t("noSeason")} />
      )}
    </main>
  );
}
