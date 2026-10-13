import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { formatSar } from "@/lib/format";
import type { ManagerOverview, ManagerRegistration } from "@/lib/team-data";
import { Badge } from "@/components/ui/badge";
import { Card, cardVariants } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
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

/**
 * Team manager home: what to do next, how each team stands, and the next
 * games. Read-only for everything the league decides.
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
        <div className="space-y-2 p-5 sm:p-7">
          <p className="text-sm font-semibold text-on-dark-muted">
            {t("role")} · {leagueName}
          </p>
          <h1 className="break-words font-display text-4xl font-semibold tracking-wide sm:text-5xl">
            {registrations.length
              ? [...new Set(registrations.map((item) => item.teamName))].join(
                  " · ",
                )
              : t("noTeamYet")}
          </h1>
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
                    <span className="block font-semibold leading-snug">
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
          <ul className="space-y-3">
            {registrations.map((registration) => {
              const payment = paymentByRegistration.get(registration.id);
              const next = nextGameFor(registration.id);
              const badge = payment
                ? paymentBadge(
                    payment.status,
                    (key, values) => paymentText(key, values),
                    format,
                  )
                : null;
              return (
                <li key={registration.id}>
                  <Link
                    href={`${base}/registrations/${registration.id}`}
                    className={cn(
                      cardVariants({ interactive: true }),
                      "block space-y-3",
                    )}
                  >
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block font-display text-2xl font-semibold leading-tight">
                          {registration.teamName}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {registration.seasonName} ·{" "}
                          {registration.divisionName}
                        </span>
                      </span>
                      <Badge tone={statusTone[registration.status]}>
                        {registrationText(`status.${registration.status}`)}
                      </Badge>
                    </span>
                    <span className="block text-sm">
                      {t(`statusHelp.${registration.status}`)}
                    </span>
                    {(badge || next || registration.changePending) && (
                      <span className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
                        {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
                        {registration.changePending && (
                          <Badge tone="warning">{t("changePending")}</Badge>
                        )}
                        {next && (
                          <span className="text-muted-foreground">
                            {t("nextGame", {
                              opponent:
                                next.homeName === registration.teamName
                                  ? next.awayName
                                  : next.homeName,
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
                <li key={game.id} className="space-y-1 p-4">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {t("matchup", {
                        home: game.homeName,
                        away: game.awayName,
                      })}
                    </span>
                    {game.status === "in_progress" && (
                      <Badge tone="danger">{t("liveNow")}</Badge>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {when(game.scheduledAt)}
                    {game.venue && ` · ${game.venue}`}
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
                {results.map((game) => (
                  <li
                    key={game.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 p-4"
                  >
                    <span className="font-semibold">
                      {t("result", {
                        home: game.homeName,
                        homeScore: game.homeScore ?? 0,
                        away: game.awayName,
                        awayScore: game.awayScore ?? 0,
                      })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {when(game.scheduledAt)}
                    </span>
                  </li>
                ))}
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
