import { getFormatter, getTranslations } from "next-intl/server";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import type { ScheduleGame } from "@/lib/schedule-data";

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
  if (!games.length)
    return <p className="rounded-2xl border bg-card p-5">{t("noGames")}</p>;
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
                className="space-y-3 rounded-2xl border bg-card p-4 data-[status=cancelled]:opacity-70"
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
                    <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold">
                      {t(`status.${game.status}`)}
                    </span>
                  )}
                </div>
                <p
                  className={
                    game.status === "cancelled"
                      ? "text-lg font-semibold line-through"
                      : "text-lg font-semibold"
                  }
                >
                  {t("matchup", { home: game.homeName, away: game.awayName })}
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
