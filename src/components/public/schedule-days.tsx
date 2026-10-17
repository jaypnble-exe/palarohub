import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import type { ScheduleGame } from "@/lib/schedule-data";
import { Badge } from "@/components/ui/badge";
import { cardVariants } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const statusTone = {
  in_progress: "primary",
  submitted: "warning",
  approved: "success",
  postponed: "neutral",
  cancelled: "neutral",
} as const;

/**
 * The public schedule as compact game cards grouped by Riyadh day. Finished
 * games open their box score; games being played open the live score.
 */
export async function ScheduleDays({
  slug,
  games,
  newestFirst = false,
  today,
}: {
  slug: string;
  games: readonly ScheduleGame[];
  /** Results read best from the latest day back. */
  newestFirst?: boolean;
  /** Today's Riyadh date (YYYY-MM-DD), for "Today" and "Tomorrow". */
  today: string;
}) {
  const [t, format] = await Promise.all([
    getTranslations("Schedule"),
    getFormatter(),
  ]);
  const days = new Map<string, ScheduleGame[]>();
  for (const game of games) {
    const key = game.scheduledAt
      ? toRiyadhDateTimeInput(game.scheduledAt).slice(0, 10)
      : "";
    days.set(key, [...(days.get(key) ?? []), game]);
  }
  const ordered = [...days.entries()].sort(([a], [b]) =>
    a === ""
      ? 1
      : b === ""
        ? -1
        : newestFirst
          ? b.localeCompare(a)
          : a.localeCompare(b),
  );
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);

  return (
    <div className="space-y-7">
      {ordered.map(([day, dayGames]) => (
        <section
          key={day || "tbd"}
          aria-labelledby={`day-${day || "tbd"}`}
          className="space-y-3"
        >
          <h2
            id={`day-${day || "tbd"}`}
            className="flex flex-wrap items-center gap-2 text-sm font-bold tracking-wide text-muted-foreground uppercase"
          >
            {day
              ? format.dateTime(new Date(`${day}T12:00:00Z`), {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                })
              : t("dateToBeAnnounced")}
            {day === today && <Badge tone="primary">{t("today")}</Badge>}
            {day === tomorrowKey && <Badge>{t("tomorrow")}</Badge>}
            <span className="font-medium normal-case tracking-normal">
              · {t("gamesOnDay", { count: dayGames.length })}
            </span>
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {dayGames.map((game) => {
              const score =
                game.homeScore != null && game.awayScore != null
                  ? { home: game.homeScore, away: game.awayScore }
                  : null;
              const winner =
                game.status === "approved" && score && score.home !== score.away
                  ? score.home > score.away
                    ? "home"
                    : "away"
                  : null;
              const href =
                game.status === "approved"
                  ? `/${slug}/games/${game.id}`
                  : game.status === "in_progress"
                    ? `/tv/${game.id}`
                    : null;
              const team = (side: "home" | "away") => (
                <span className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "min-w-0 break-words",
                      winner === side ? "font-bold" : "font-semibold",
                      winner && winner !== side && "text-muted-foreground",
                    )}
                  >
                    {side === "home" ? game.homeName : game.awayName}
                  </span>
                  {score && (
                    <span
                      className={cn(
                        "font-display text-2xl leading-none font-semibold tabular-nums",
                        winner && winner !== side && "text-muted-foreground",
                      )}
                    >
                      {score[side]}
                    </span>
                  )}
                </span>
              );
              const body = (
                <>
                  <span className="w-[5.5rem] shrink-0 border-r pr-3 text-center">
                    <span className="block font-display text-lg leading-tight font-semibold">
                      {game.scheduledAt
                        ? format.dateTime(new Date(game.scheduledAt), {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "–"}
                    </span>
                    {game.status !== "scheduled" && (
                      <Badge
                        tone={statusTone[game.status]}
                        className="mt-1 px-2 py-0.5 text-xs"
                      >
                        {game.status === "in_progress" && (
                          <span
                            className="size-1.5 animate-pulse rounded-full bg-white"
                            aria-hidden="true"
                          />
                        )}
                        {t(`publicStatus.${game.status}`)}
                      </Badge>
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 space-y-1.5",
                      game.status === "cancelled" && "line-through",
                    )}
                  >
                    {team("home")}
                    {team("away")}
                    <span className="block text-sm text-muted-foreground">
                      {[
                        game.divisionName,
                        game.venue,
                        game.round ? t("round", { round: game.round }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {game.outcome && game.outcome !== "played" && (
                      <span className="block text-sm font-semibold text-orange-dark no-underline">
                        {t(`outcome.${game.outcome}`, {
                          team:
                            game.forfeitedBy === "away"
                              ? game.awayName
                              : game.homeName,
                          both: game.forfeitedBy === "both" ? "yes" : "no",
                        })}
                      </span>
                    )}
                  </span>
                  {href && (
                    <Icon
                      name="arrow"
                      className="size-5 shrink-0 self-center text-muted-foreground"
                    />
                  )}
                </>
              );
              const classes = cn(
                cardVariants({ interactive: Boolean(href), padding: "sm" }),
                "flex h-full gap-3 sm:p-4",
                game.status === "in_progress" && "border-primary/60",
                game.status === "cancelled" && "opacity-70",
              );
              return (
                <li key={game.id}>
                  {href ? (
                    <Link href={href} className={classes}>
                      {body}
                    </Link>
                  ) : (
                    <div className={classes}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
