import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { BracketData } from "@/lib/competition-data";
import { cardVariants } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export async function BracketBoard({
  data,
  divisions,
  slug,
  admin = false,
}: {
  data: BracketData;
  divisions: readonly { id: string; name: string }[];
  slug: string;
  admin?: boolean;
}) {
  const t = await getTranslations("Competition");
  const format = await getFormatter();
  const names = new Map(data.teams.map((team) => [team.id, team.team_name]));
  if (!data.brackets.length)
    return (
      <EmptyState title={t("noBracket")} description={t("noBracketHelp")} />
    );
  return (
    <div className="space-y-8">
      {data.brackets.map((bracket) => {
        const slots = data.slots.filter(
          (slot) => slot.bracket_id === bracket.id,
        );
        const rounds = [...new Set(slots.map((slot) => slot.round_no))];
        const maxRound = Math.max(...rounds);
        const final = slots.find((slot) => slot.round_no === maxRound);
        const name = (teamId: string | null) =>
          teamId ? (names.get(teamId) ?? t("teamUnknown")) : t("teamUnknown");
        const label = (slot: (typeof slots)[number], home: boolean) => {
          const team = home ? slot.home_team_id : slot.away_team_id;
          if (team) return name(team);
          const source = slots.find(
            (item) => item.id === (home ? slot.home_source : slot.away_source),
          );
          return source
            ? t("winnerOf", { round: source.round_no, match: source.position })
            : t("bye");
        };
        return (
          <section key={bracket.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-semibold">
                {divisions.find((d) => d.id === bracket.division_id)?.name}
              </h2>
              <Badge>{t(`preset.${bracket.preset}`)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t(bracket.preset === "twice" ? "twiceHelp" : "bracketHelp")}
            </p>
            {final?.winner_id && (
              <p className="rounded-xl bg-success-soft p-4 font-semibold text-success">
                {t("champion", { team: name(final.winner_id) })}
              </p>
            )}
            <div
              role="region"
              aria-label={t("bracketRounds")}
              tabIndex={0}
              className="flex gap-4 overflow-x-auto overscroll-x-contain pb-4"
            >
              {rounds.map((round) => (
                <div key={round} className="flex w-72 shrink-0 flex-col gap-3">
                  <h3 className="text-sm font-bold uppercase text-muted-foreground">
                    {t(
                      round === maxRound
                        ? "final"
                        : round === maxRound - 1
                          ? "semifinal"
                          : round === maxRound - 2
                            ? "quarterfinal"
                            : "round",
                      { round },
                    )}
                  </h3>
                  <div className="flex flex-1 flex-col justify-around gap-4">
                    {slots
                      .filter((slot) => slot.round_no === round)
                      .map((slot) => {
                        const games = data.games.filter(
                          (game) => game.bracket_slot_id === slot.id,
                        );
                        const wins = (teamId: string | null) =>
                          games.filter(
                            (game) =>
                              game.status === "approved" &&
                              game.home_score !== null &&
                              game.away_score !== null &&
                              ((game.home_season_team_id === teamId &&
                                game.home_score > game.away_score) ||
                                (game.away_season_team_id === teamId &&
                                  game.away_score > game.home_score)),
                          ).length;
                        return (
                          <article
                            key={slot.id}
                            className={`${cardVariants({ padding: "sm" })} space-y-3`}
                          >
                            <h4 className="text-xs font-semibold text-muted-foreground">
                              {t("match", { round, match: slot.position })}
                            </h4>
                            {([true, false] as const).map((home) => {
                              const teamId = home
                                ? slot.home_team_id
                                : slot.away_team_id;
                              const required = home
                                ? slot.home_required
                                : slot.away_required;
                              return (
                                <div
                                  key={String(home)}
                                  className={`flex items-start justify-between gap-2 ${teamId && slot.winner_id === teamId ? "font-bold text-success" : ""}`}
                                >
                                  <span className="min-w-0 break-words">
                                    {slot.round_no === 1 && teamId && (
                                      <span className="mr-2 text-xs text-muted-foreground">
                                        {home ? slot.home_seed : slot.away_seed}
                                      </span>
                                    )}
                                    {label(slot, home)}
                                  </span>
                                  {teamId && (
                                    <span className="shrink-0 text-xs tabular-nums">
                                      {t("seriesWins", {
                                        won: wins(teamId),
                                        required,
                                      })}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {games.length > 0 && (
                              <details className="border-t pt-2">
                                <summary className="min-h-11 cursor-pointer text-sm font-semibold">
                                  {t("seriesGames", { count: games.length })}
                                </summary>
                                <ul className="space-y-3 pb-2">
                                  {games.map((game) => (
                                    <li
                                      key={game.id}
                                      className="space-y-1 text-sm"
                                    >
                                      <p>
                                        {t("gameNumber", {
                                          number: game.bracket_game_number ?? 1,
                                        })}{" "}
                                        ·{" "}
                                        {t(
                                          `gameState.${game.status ?? "postponed"}`,
                                        )}
                                        {game.home_score !== null &&
                                        game.away_score !== null
                                          ? ` · ${game.home_score}–${game.away_score}`
                                          : ""}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {game.scheduled_at
                                          ? format.dateTime(
                                              new Date(game.scheduled_at),
                                              {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                              },
                                            )
                                          : t("needsTime")}
                                        {game.venue ? ` · ${game.venue}` : ""}
                                      </p>
                                      <Link
                                        className="inline-flex min-h-11 items-center font-semibold text-orange-dark hover:underline"
                                        href={
                                          admin
                                            ? `/admin/${slug}/schedule/${bracket.division_id}`
                                            : `/tv/${game.id}`
                                        }
                                      >
                                        {t(admin ? "manageGame" : "viewTv")}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </article>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
