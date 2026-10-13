import { getFormatter, getTranslations } from "next-intl/server";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import type { ScheduleGame } from "@/lib/schedule-data";
import { EmptyState } from "@/components/ui/empty-state";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Games grouped by their Riyadh date; postponed games without a date go last. */
export async function GameList({
  games,
  actions,
}: {
  games: readonly ScheduleGame[];
  actions?: (game: ScheduleGame) => React.ReactNode;
}) {
  const t = await getTranslations("Schedule");
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
  if (!games.length) return <EmptyState title={t("noGames")} />;
  return (
    <div className="space-y-6">
      {ordered.map(([day, dayGames]) => (
        <section key={day || "tbd"} className="space-y-3">
          <h3 className="font-display text-xl font-semibold">
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
            {dayGames.map((game) => (
              <li
                key={game.id}
                className={cn(
                  cardVariants(),
                  "space-y-3 data-[status=cancelled]:opacity-70",
                )}
                data-status={game.status}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {game.scheduledAt
                      ? format.dateTime(new Date(game.scheduledAt), {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : t("timeToBeAnnounced")}
                    {game.venue && (
                      <span className="font-normal text-muted-foreground">
                        {" · "}
                        {game.venue}
                      </span>
                    )}
                  </p>
                  {game.status !== "scheduled" && (
                    <Badge>{t(`status.${game.status}`)}</Badge>
                  )}
                </div>
                <p
                  className={
                    game.status === "cancelled"
                      ? "text-lg font-semibold line-through"
                      : "text-lg font-semibold"
                  }
                >
                  {game.homeScore != null && game.awayScore != null
                    ? t("finalResult", {
                        home: game.homeName,
                        homeScore: game.homeScore,
                        away: game.awayName,
                        awayScore: game.awayScore,
                      })
                    : t("matchup", {
                        home: game.homeName,
                        away: game.awayName,
                      })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[
                    game.divisionName,
                    game.round ? t("round", { round: game.round }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {actions?.(game)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
