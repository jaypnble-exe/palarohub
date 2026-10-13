import { getFormatter, getTranslations } from "next-intl/server";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import type { ScheduleGame } from "@/lib/schedule-data";
import type { LiveScore } from "@/lib/sports/types";
import { EmptyState } from "@/components/ui/empty-state";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const statusTone = {
  scheduled: "neutral",
  in_progress: "primary",
  submitted: "warning",
  approved: "success",
  postponed: "neutral",
  cancelled: "neutral",
} as const;

/** Games grouped by their Riyadh date; postponed games without a date go last. */
export async function GameList({
  games,
  actions,
  scores,
  emptyTitle,
}: {
  games: readonly ScheduleGame[];
  actions?: (game: ScheduleGame) => React.ReactNode;
  /** The score so far for games being played. */
  scores?: ReadonlyMap<string, LiveScore>;
  emptyTitle?: string;
}) {
  const t = await getTranslations("Schedule");
  const live = await getTranslations("LiveStatus");
  const format = await getFormatter();
  const days = new Map<string, ScheduleGame[]>();
  for (const game of games) {
    const key = game.scheduledAt
      ? toRiyadhDateTimeInput(game.scheduledAt).slice(0, 10)
      : "";
    days.set(key, [...(days.get(key) ?? []), game]);
  }
  const ordered = [...days.entries()].sort(([a], [b]) =>
    a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
  );
  if (!games.length)
    return <EmptyState icon="schedule" title={emptyTitle ?? t("noGames")} />;
  return (
    <div className="space-y-6">
      {ordered.map(([day, dayGames]) => (
        <section key={day || "tbd"} className="space-y-2">
          <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            {day
              ? format.dateTime(new Date(`${day}T12:00:00Z`), {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                })
              : t("dateToBeAnnounced")}
          </h3>
          <ul className="space-y-3">
            {dayGames.map((game) => {
              const score =
                game.homeScore != null && game.awayScore != null
                  ? { home: game.homeScore, away: game.awayScore }
                  : scores?.get(game.id)
                    ? {
                        home: scores.get(game.id)!.homeScore,
                        away: scores.get(game.id)!.awayScore,
                      }
                    : null;
              const liveStatus = scores?.get(game.id)?.status;
              const winner =
                game.status === "approved" && score && score.home !== score.away
                  ? score.home > score.away
                    ? "home"
                    : "away"
                  : null;
              const team = (side: "home" | "away", name: string) => (
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "truncate text-lg",
                      winner === side ? "font-bold" : "font-semibold",
                      winner && winner !== side && "text-muted-foreground",
                    )}
                  >
                    {name}
                  </span>
                  {score && (
                    <span
                      className={cn(
                        "font-display text-2xl font-semibold tabular-nums",
                        winner && winner !== side && "text-muted-foreground",
                      )}
                    >
                      {score[side]}
                    </span>
                  )}
                </div>
              );
              return (
                <li
                  key={game.id}
                  className={cn(
                    cardVariants(),
                    "space-y-3 data-[status=cancelled]:opacity-70",
                    game.status === "in_progress" && "border-primary/50",
                  )}
                  data-status={game.status}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {game.scheduledAt
                        ? format.dateTime(new Date(game.scheduledAt), {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : t("timeToBeAnnounced")}
                      <span className="font-normal text-muted-foreground">
                        {[
                          game.venue,
                          game.round ? t("round", { round: game.round }) : null,
                        ]
                          .filter(Boolean)
                          .map((part) => ` · ${part}`)
                          .join("")}
                      </span>
                    </p>
                    {game.status !== "scheduled" && (
                      <Badge tone={statusTone[game.status]}>
                        {t(`status.${game.status}`)}
                      </Badge>
                    )}
                  </div>
                  <div
                    className={cn(
                      "space-y-1",
                      game.status === "cancelled" && "line-through",
                    )}
                    aria-label={t("matchup", {
                      home: game.homeName,
                      away: game.awayName,
                    })}
                  >
                    {team("home", game.homeName)}
                    {team("away", game.awayName)}
                  </div>
                  {liveStatus && (
                    <p className="font-display text-base tracking-wide text-orange-dark">
                      {live(liveStatus.key, liveStatus.values)}
                    </p>
                  )}
                  {actions?.(game)}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
