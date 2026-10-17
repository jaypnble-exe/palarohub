import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { formatSar } from "@/lib/format";
import type {
  ManagerGame,
  ManagerOverview,
  ManagerRegistration,
} from "@/lib/team-data";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, cardVariants } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { Progress } from "@/components/ui/stat";
import { TileGrid, type Tile } from "@/components/ui/tile-grid";
import { Button } from "@/components/ui/button";
import { paymentBadge } from "@/components/payments/payment-summary";
import { cn } from "@/lib/utils";
import { managerTodos } from "./todos";

const statusTone: Record<
  ManagerRegistration["status"],
  "neutral" | "warning" | "success" | "danger"
> = {
  draft: "neutral",
  submitted: "warning",
  returned: "warning",
  approved: "success",
  rejected: "danger",
};
const dayMs = 86_400_000;
const riyadhOffsetMs = 3 * 3_600_000;
/** Calendar days in Riyadh, so "Tomorrow" flips at local midnight. */
const riyadhDay = (date: Date) =>
  Math.floor((date.getTime() + riyadhOffsetMs) / dayMs);

/**
 * Team manager home: the next game first, then what to do, how each team
 * stands, and the schedule. Read-only for everything the league decides.
 */
export async function TeamHome({
  slug,
  leagueName,
  overview,
  canView,
}: {
  slug: string;
  leagueName: string;
  overview: ManagerOverview;
  /** The viewer is also commissioner or staff. */
  canView: boolean;
}) {
  const t = await getTranslations("TeamHome");
  const registrationText = await getTranslations("Registration");
  const paymentText = await getTranslations("Payments");
  const format = await getFormatter();
  const base = `/team/${slug}`;
  const { registrations, openSeasons, games, payments } = overview;
  const deadline = (iso: string) =>
    format.dateTime(new Date(iso), {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  const behind = payments
    .filter((team) => team.status.behind)
    .map((team) => ({
      id: team.seasonTeamId,
      // The same team can owe in more than one division.
      teamName: team.divisionName
        ? `${team.teamName} · ${team.divisionName}`
        : team.teamName,
      amount: formatSar(format, team.status.behindByHalalas),
    }));
  const todos = managerTodos(
    slug,
    registrations,
    behind,
    openSeasons,
    deadline,
  );
  const paymentByRegistration = new Map(
    payments.map((team) => [team.seasonTeamId, team]),
  );
  const upcoming = games
    .filter(
      (game) => game.status === "scheduled" || game.status === "in_progress",
    )
    .slice(0, 3);
  const results = games
    .filter((game) => game.status === "approved" && game.homeScore !== null)
    .slice(-3)
    .reverse();
  const nextGameFor = (registrationId: string) =>
    games.find(
      (game) =>
        game.registrationId === registrationId &&
        (game.status === "scheduled" || game.status === "in_progress"),
    );
  const teamNameOf = new Map(
    registrations.map((item) => [item.id, item.teamName]),
  );
  const teamNames = [...new Set(teamNameOf.values())];
  /** Which side the manager's team is on, so every game reads "vs opponent". */
  const sideOf = (game: ManagerGame) => {
    const own = teamNameOf.get(game.registrationId);
    const home = game.homeName === own;
    return {
      team: own ?? game.homeName,
      opponent: home ? game.awayName : game.homeName,
      home,
      scored: (home ? game.homeScore : game.awayScore) ?? 0,
      allowed: (home ? game.awayScore : game.homeScore) ?? 0,
    };
  };
  const recordOf = (registrationId: string) => {
    const played = games.filter(
      (game) =>
        game.registrationId === registrationId &&
        game.status === "approved" &&
        game.homeScore !== null,
    );
    const wins = played.filter((game) => {
      const side = sideOf(game);
      return side.scored > side.allowed;
    }).length;
    return { played: played.length, wins, losses: played.length - wins };
  };
  const live = games.find((game) => game.status === "in_progress");
  const nextGame = live ?? upcoming[0];
  const daysUntil = (iso: string) =>
    Math.max(0, riyadhDay(new Date(iso)) - riyadhDay(new Date()));
  const when = (iso: string | null) =>
    iso
      ? format.dateTime(new Date(iso), {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })
      : t("timeToBeAnnounced");
  const tiles: Tile[] = [
    { href: `/${slug}/schedule`, icon: "schedule", label: t("tileSchedule") },
    {
      href: `/${slug}/standings`,
      icon: "standings",
      label: t("tileStandings"),
    },
    { href: `/${slug}`, icon: "public", label: t("tileLeague") },
    ...(openSeasons.length
      ? [
          {
            href: `${base}/register/${openSeasons[0].seasonId}`,
            icon: "add" as const,
            label: t("tileRegister"),
          },
        ]
      : []),
  ];

  return (
    <main className="space-y-7 py-6 sm:space-y-8">
      <Card tone="navy" padding="none" className="overflow-hidden">
        <div className="h-1.5 bg-primary" />
        <div className="space-y-5 p-5 sm:p-7">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-on-dark-muted">
              {t("role")} · {leagueName}
            </p>
            <h1
              className={cn(
                "font-display font-semibold tracking-wide break-words",
                teamNames.length > 1
                  ? "space-y-1 text-3xl sm:text-4xl"
                  : "text-4xl sm:text-5xl",
              )}
            >
              {teamNames.length
                ? teamNames.map((name) => (
                    <span key={name} className="block">
                      {name}
                    </span>
                  ))
                : t("noTeamYet")}
            </h1>
          </div>
          {nextGame ? (
            <div className="space-y-3 rounded-2xl bg-white/10 p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-on-dark-muted">
                {live ? (
                  <Badge tone="primary">
                    <span
                      className="size-2 animate-pulse rounded-full bg-white"
                      aria-hidden="true"
                    />
                    {t("playingNow", { team: sideOf(live).team })}
                  </Badge>
                ) : (
                  <>
                    {t("nextUp")}
                    {nextGame.scheduledAt && (
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-white">
                        {t("inDays", { days: daysUntil(nextGame.scheduledAt) })}
                      </span>
                    )}
                  </>
                )}
              </p>
              <p className="font-display text-2xl leading-tight font-semibold break-words sm:text-3xl">
                {t("versus", { opponent: sideOf(nextGame).opponent })}
              </p>
              <p className="text-sm text-on-dark-muted">
                {[
                  teamNames.length > 1 ? sideOf(nextGame).team : null,
                  when(nextGame.scheduledAt),
                  nextGame.venue || null,
                  t(sideOf(nextGame).home ? "home" : "away"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {live && (
                <Button asChild className="w-full sm:w-auto">
                  <Link href={`/tv/${live.id}`}>
                    <Icon name="live" className="size-5" />
                    {t("watchLive")}
                  </Link>
                </Button>
              )}
            </div>
          ) : registrations.some((item) => item.status === "approved") ? (
            <p className="rounded-2xl bg-white/10 p-4 text-sm text-on-dark-muted">
              {t("noNextGame")}
            </p>
          ) : null}
        </div>
      </Card>

      <Section id="todo" title={t("todo")}>
        {todos.length ? (
          <ul className="space-y-3">
            {todos.map((todo) => (
              <li key={todo.key}>
                <Card
                  padding="sm"
                  className="flex items-center gap-3 sm:gap-4 sm:p-4"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-soft text-orange-dark">
                    <Icon name={todo.icon} />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block leading-snug font-semibold">
                      {t(todo.text, todo.values)}
                    </span>
                    {todo.quote && (
                      <span className="block text-sm text-muted-foreground">
                        “{todo.quote}”
                      </span>
                    )}
                  </span>
                  <Link
                    href={todo.href}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-navy px-4 text-sm font-bold text-on-dark hover:bg-navy-secondary"
                  >
                    {t(todo.action)}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-success text-white">
              <Icon name="check" />
            </span>
            <div>
              <p className="font-semibold">{t("allSet")}</p>
              <p className="text-sm text-muted-foreground">{t("allSetHelp")}</p>
            </div>
          </Card>
        )}
      </Section>

      <Section id="teams" title={t("yourTeams")}>
        {registrations.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {registrations.map((registration) => {
              const payment = paymentByRegistration.get(registration.id);
              const next = nextGameFor(registration.id);
              const record = recordOf(registration.id);
              const badge = payment
                ? paymentBadge(
                    payment.status,
                    (key, values) => paymentText(key, values),
                    format,
                  )
                : null;
              const owed = payment
                ? payment.quotaHalalas + payment.finesHalalas
                : 0;
              return (
                <li key={registration.id}>
                  <Link
                    href={`${base}/registrations/${registration.id}`}
                    className={cn(
                      cardVariants({ interactive: true }),
                      "block h-full space-y-3",
                    )}
                  >
                    <span className="flex items-start gap-3">
                      <Avatar
                        name={registration.teamName}
                        className="size-12 bg-navy text-xl text-on-dark"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-2xl leading-tight font-semibold break-words">
                          {registration.teamName}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {registration.seasonName} ·{" "}
                          {registration.divisionName}
                        </span>
                        <Badge
                          tone={statusTone[registration.status]}
                          className="mt-2"
                        >
                          {registrationText(`status.${registration.status}`)}
                        </Badge>
                      </span>
                    </span>
                    <span className="block text-sm">
                      {t(`statusHelp.${registration.status}`)}
                    </span>
                    {(record.played > 0 || payment) && (
                      <span className="grid grid-cols-2 gap-3 border-t pt-3">
                        {record.played > 0 && (
                          <span className="space-y-0.5">
                            <span className="block text-xs font-bold tracking-wide text-muted-foreground uppercase">
                              {t("record")}
                            </span>
                            <span className="block font-display text-2xl font-semibold tabular-nums">
                              {t("recordValue", {
                                wins: record.wins,
                                losses: record.losses,
                              })}
                            </span>
                          </span>
                        )}
                        {payment && (
                          <span className="col-start-2 space-y-1">
                            <span className="block text-xs font-bold tracking-wide text-muted-foreground uppercase">
                              {t("paid")}
                            </span>
                            <span className="block text-sm font-semibold tabular-nums">
                              {t("paidOf", {
                                paid: formatSar(format, payment.paidHalalas),
                                total: formatSar(format, owed),
                              })}
                            </span>
                            <Progress
                              value={payment.paidHalalas}
                              max={owed}
                              label={t("paid")}
                            />
                          </span>
                        )}
                      </span>
                    )}
                    {(badge || next || registration.changePending) && (
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
                        {registration.changePending && (
                          <Badge tone="warning">{t("changePending")}</Badge>
                        )}
                        {next && (
                          <span className="text-muted-foreground">
                            {t("nextGame", {
                              opponent: sideOf(next).opponent,
                              when: when(next.scheduledAt),
                            })}
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon="teams"
            title={t("noTeams")}
            description={
              openSeasons.length ? t("noTeamsOpen") : t("noTeamsClosed")
            }
            action={
              openSeasons.length ? (
                <Button asChild>
                  <Link href={`${base}/register/${openSeasons[0].seasonId}`}>
                    {t("actionRegister")}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </Section>

      {games.length > 0 && (
        <Section
          id="next"
          title={t("nextGames")}
          action={{ href: `${base}/games`, label: t("allGames") }}
        >
          {upcoming.length ? (
            <ul className={cn(cardVariants({ padding: "none" }), "divide-y")}>
              {upcoming.map((game) => (
                <li key={game.id} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-20 shrink-0 text-center">
                    {game.scheduledAt ? (
                      <>
                        <span className="block text-xs font-bold text-muted-foreground uppercase">
                          {format.dateTime(new Date(game.scheduledAt), {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <span className="block font-display text-lg font-semibold">
                          {format.dateTime(new Date(game.scheduledAt), {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </>
                    ) : (
                      <span className="block text-xs font-bold text-muted-foreground uppercase">
                        {t("timeToBeAnnounced")}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold break-words">
                        {t("matchup", {
                          home: game.homeName,
                          away: game.awayName,
                        })}
                      </span>
                      {game.status === "in_progress" && (
                        <Badge tone="primary">{t("liveNow")}</Badge>
                      )}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[t(sideOf(game).home ? "home" : "away"), game.venue]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="schedule" title={t("noUpcoming")} />
          )}
          {results.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="text-lg font-semibold">{t("latestResults")}</h3>
              <ul className={cn(cardVariants({ padding: "none" }), "divide-y")}>
                {results.map((game) => {
                  const side = sideOf(game);
                  const won = side.scored > side.allowed;
                  return (
                    <li
                      key={game.id}
                      className="flex items-center gap-4 px-4 py-3"
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl font-display text-lg font-bold",
                          won
                            ? "bg-success text-white"
                            : "bg-destructive-soft text-destructive",
                        )}
                      >
                        <span aria-hidden="true">
                          {t(won ? "won" : "lost")}
                        </span>
                        <span className="sr-only">
                          {t(won ? "wonLabel" : "lostLabel")}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold break-words">
                          {t("result", {
                            home: game.homeName,
                            homeScore: game.homeScore ?? 0,
                            away: game.awayName,
                            awayScore: game.awayScore ?? 0,
                          })}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {when(game.scheduledAt)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Section>
      )}

      <Section id="shortcuts" title={t("shortcuts")}>
        <TileGrid tiles={tiles} />
      </Section>

      {canView && (
        <Link
          href={`/admin/${slug}`}
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-orange-dark hover:underline"
        >
          <Icon name="back" className="size-5" />
          {t("backToCommissioner")}
        </Link>
      )}
    </main>
  );
}
