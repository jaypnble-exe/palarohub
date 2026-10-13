import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { seasonWeek, type SeasonPhase } from "@/lib/domain/season-phase";
import type { RegistrationState } from "@/lib/domain/registration-window";
import { Badge } from "@/components/ui/badge";
import { cardVariants } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

export interface AdminSeason {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  divisions: { name: string; max_rating: string }[];
  phase: SeasonPhase;
  registration: RegistrationState;
  deadline?: string;
  teams: number;
  waiting: number;
  games: number;
  gamesPlayed: number;
}

const phaseTone = {
  draft: "warning",
  upcoming: "primary",
  inProgress: "success",
  finished: "dark",
} as const;

/** One season at a glance; the whole card opens its setup. */
export async function SeasonCard({
  slug,
  season,
  today,
}: {
  slug: string;
  season: AdminSeason;
  today: string;
}) {
  const t = await getTranslations("Seasons");
  const format = await getFormatter();
  const date = (value: string) =>
    format.dateTime(new Date(`${value}T12:00:00Z`), { dateStyle: "medium" });
  const week =
    season.phase === "inProgress" ? seasonWeek(season, today) : undefined;
  const status =
    season.phase === "draft"
      ? t("nextFinishSetup")
      : season.phase === "finished"
        ? undefined
        : season.registration === "open" && season.deadline
          ? t("registrationOpenUntil", {
              date: format.dateTime(new Date(season.deadline), {
                day: "numeric",
                month: "short",
              }),
            })
          : season.phase === "upcoming"
            ? t("nextOpenRegistration")
            : undefined;
  return (
    <li>
      <Link
        href={`/admin/${slug}/seasons/${season.id}`}
        className={cn(
          cardVariants({ interactive: true }),
          "block space-y-4",
          season.phase === "inProgress" && "border-success/40",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Badge tone={phaseTone[season.phase]}>
              {t(`phase.${season.phase}`)}
            </Badge>
            <h3 className="font-display text-2xl leading-tight font-semibold">
              {season.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("dates", {
                start: date(season.start_date),
                end: date(season.end_date),
              })}
            </p>
          </div>
          <Icon
            name="arrow"
            className="mt-1 size-5 shrink-0 text-muted-foreground"
          />
        </div>
        {week && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">
              {t("weekOf", { current: week.current, total: week.total })}
            </p>
            <Progress
              value={week.current}
              max={week.total}
              label={t("weekOf", { current: week.current, total: week.total })}
            />
          </div>
        )}
        {season.phase !== "draft" && (
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["statTeams", season.teams],
                ["statWaiting", season.waiting],
                ["statGames", `${season.gamesPlayed}/${season.games}`],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-accent/60 p-2">
                <dt className="text-xs font-semibold text-muted-foreground">
                  {t(label)}
                </dt>
                <dd className="font-display text-xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {season.divisions.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={t("divisions")}>
            {season.divisions.map((division) => (
              <li
                key={division.name}
                className="rounded-lg border bg-background px-2.5 py-1 text-sm"
              >
                <span className="font-semibold">{division.name}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {t("maximum", { rating: division.max_rating })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {status && (
          <p
            className={cn(
              "flex items-center gap-2 border-t pt-3 text-sm font-semibold",
              season.phase === "draft" ? "text-orange-dark" : "text-success",
            )}
          >
            <Icon
              name={season.phase === "draft" ? "review" : "check"}
              className="size-4"
            />
            {status}
          </p>
        )}
      </Link>
    </li>
  );
}
