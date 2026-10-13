import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import { formatSar } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, cardVariants } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { LinkCard } from "@/components/ui/link-card";
import { Section } from "@/components/ui/section";
import { CountBadge, StatTile } from "@/components/ui/stat";
import { TileGrid } from "@/components/ui/tile-grid";
import { cn } from "@/lib/utils";
import { buildTodos, type DashboardTasks } from "./todos";

export interface DashboardGame {
  id: string;
  divisionId: string;
  home: string;
  away: string;
  venue: string;
  division: string;
  scheduledAt: string | null;
}

export interface DashboardSeason {
  name: string;
  teams: number;
  gamesPlayed: number;
  gamesTotal: number;
  collectedHalalas: number;
  expectedHalalas: number;
}

export interface DashboardSetup {
  seasonId: string | null;
  hasSeason: boolean;
  registrationReady: boolean;
  teamsApproved: boolean;
  scheduled: boolean;
}

interface DashboardProps {
  league: { name: string; slug: string; sport: string };
  displayName: string;
  role: string;
  members: { id: string; name: string; roles: string[] }[];
  isDemo: boolean;
  season: DashboardSeason | null;
  setup: DashboardSetup;
  liveGames: DashboardGame[];
  upcomingGames: DashboardGame[];
  tasks: DashboardTasks;
}

/** Riyadh calendar day of a UTC time, YYYY-MM-DD. */
const riyadhDay = (utc: string) => toRiyadhDateTimeInput(utc).slice(0, 10);

/**
 * Commissioner home: "what do I need to do today?" first, then what is
 * happening now and next. Everything else is one tap away in the bottom bar.
 */
export async function Dashboard({
  league,
  displayName,
  role,
  members,
  isDemo,
  season,
  setup,
  liveGames,
  upcomingGames,
  tasks,
}: DashboardProps) {
  const t = await getTranslations("AdminHome");
  const sports = await getTranslations("Sports");
  const format = await getFormatter();
  const base = `/admin/${league.slug}`;
  const todos = buildTodos(league.slug, tasks);
  const now = new Date().toISOString();
  const today = riyadhDay(now);
  const tomorrow = riyadhDay(
    new Date(new Date().getTime() + 86_400_000).toISOString(),
  );
  const hour = Number(toRiyadhDateTimeInput(now).slice(11, 13));
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const dayLabel = (game: DashboardGame) => {
    if (!game.scheduledAt) return t("timeToBeAnnounced");
    const time = format.dateTime(new Date(game.scheduledAt), {
      hour: "numeric",
      minute: "2-digit",
    });
    const day = riyadhDay(game.scheduledAt);
    if (day === today) return t("todayAt", { time });
    if (day === tomorrow) return t("tomorrowAt", { time });
    return format.dateTime(new Date(game.scheduledAt), {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  };
  const steps = [
    {
      key: "season",
      done: setup.hasSeason,
      href: `${base}/seasons`,
    },
    {
      key: "registration",
      done: setup.registrationReady,
      href: setup.seasonId
        ? `${base}/seasons/${setup.seasonId}/registration`
        : `${base}/seasons`,
    },
    { key: "teams", done: setup.teamsApproved, href: `${base}/registrations` },
    { key: "schedule", done: setup.scheduled, href: `${base}/schedule` },
  ];
  const nextStep = steps.find((step) => !step.done);

  return (
    <main className="space-y-7 py-6 sm:space-y-8">
      {isDemo && (
        <Alert tone="warning" title={t("demoTitle")}>
          {t("demoDescription")}
        </Alert>
      )}

      <Card tone="navy" padding="none" className="overflow-hidden">
        <div className="h-1.5 bg-primary" />
        <div className="space-y-3 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-on-dark-muted">{role}</p>
            <Badge tone="dark">{sports(league.sport)}</Badge>
          </div>
          <h1 className="break-words font-display text-4xl font-semibold tracking-wide sm:text-5xl">
            {league.name}
          </h1>
          <p className="text-on-dark-muted">
            {season?.name ?? t("noSeasonYet")}
          </p>
        </div>
      </Card>

      <p className="text-xl font-semibold">
        {displayName
          ? t(`greeting.${greeting}`, { name: displayName })
          : t("welcomeRole", { role })}
      </p>

      {nextStep && (
        <Section
          id="setup"
          title={t("setupTitle")}
          description={t("setupHelp")}
        >
          <ol className="space-y-2">
            {steps.map((step, index) => {
              const current = step === nextStep;
              return (
                <li key={step.key}>
                  <Link
                    href={step.href}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      cardVariants({
                        tone: current ? "highlight" : "default",
                        interactive: true,
                        padding: "sm",
                      }),
                      "flex items-center gap-3",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-full font-bold",
                        step.done
                          ? "bg-success text-white"
                          : current
                            ? "bg-primary text-white"
                            : "bg-accent text-muted-foreground",
                      )}
                    >
                      {step.done ? (
                        <Icon name="check" className="size-5" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block font-semibold",
                          step.done && "text-muted-foreground line-through",
                        )}
                      >
                        {t(`setup.${step.key}`)}
                      </span>
                      {current && (
                        <span className="block text-sm text-muted-foreground">
                          {t(`setupHelpStep.${step.key}`)}
                        </span>
                      )}
                    </span>
                    {current && (
                      <span className="text-sm font-bold text-orange-dark">
                        {t("setupStart")}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      <Section id="todo" title={t("todo")}>
        {todos.length ? (
          <ul className="space-y-3">
            {todos.map((todo) => (
              <li key={todo.key}>
                <Card
                  padding="sm"
                  className="flex items-center gap-3 sm:gap-4 sm:p-4"
                >
                  <CountBadge count={todo.count} />
                  <span className="min-w-0 flex-1 font-semibold leading-snug">
                    <span className="sr-only">{todo.count} </span>
                    {t(todo.text, { count: todo.count })}
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
              <p className="font-semibold">{t("allCaughtUp")}</p>
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          </Card>
        )}
      </Section>

      {liveGames.length > 0 && (
        <Section
          id="live"
          title={
            <span className="flex items-center gap-2">
              <span
                className="size-3 animate-pulse rounded-full bg-destructive"
                aria-hidden="true"
              />
              {t("liveNow")}
            </span>
          }
        >
          <ul className="space-y-3">
            {liveGames.map((game) => (
              <li key={game.id}>
                <LinkCard
                  tone="navy"
                  href={`${base}/games/${game.id}`}
                  title={t("matchup", { home: game.home, away: game.away })}
                  subtitle={[game.division, game.venue]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        id="next"
        title={t("comingUp")}
        action={{ href: `${base}/schedule`, label: t("fullSchedule") }}
      >
        {upcomingGames.length ? (
          <ul
            className={cn(
              cardVariants({ padding: "none" }),
              "divide-y overflow-hidden",
            )}
          >
            {upcomingGames.map((game) => {
              const isToday =
                game.scheduledAt && riyadhDay(game.scheduledAt) === today;
              return (
                <li
                  key={game.id}
                  className="flex flex-wrap items-center gap-3 p-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {t("matchup", { home: game.home, away: game.away })}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {dayLabel(game)}
                      {game.venue && ` · ${game.venue}`}
                    </span>
                  </span>
                  {isToday && game.divisionId && (
                    <Link
                      href={`${base}/schedule/${game.divisionId}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-navy px-3 text-sm font-bold hover:bg-accent"
                    >
                      <Icon name="pin" className="size-5" />
                      {t("scorerPin")}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon="schedule"
            title={t("noUpcoming")}
            description={t("noUpcomingHelp")}
          />
        )}
      </Section>

      {season && (
        <Section id="season" title={t("thisSeason")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              label={t("statTeams")}
              value={season.teams}
              detail={t("statTeamsDetail")}
              href={`${base}/teams`}
            />
            <StatTile
              label={t("statGames")}
              value={t("ofTotal", {
                value: season.gamesPlayed,
                total: season.gamesTotal,
              })}
              detail={t("statGamesDetail")}
              progress={{ value: season.gamesPlayed, max: season.gamesTotal }}
              href={`${base}/games`}
            />
            <StatTile
              label={t("statCollected")}
              value={formatSar(format, season.collectedHalalas)}
              detail={t("statCollectedDetail", {
                total: formatSar(format, season.expectedHalalas),
              })}
              progress={{
                value: season.collectedHalalas,
                max: season.expectedHalalas,
              }}
              href={`${base}/payments`}
              className="col-span-2 sm:col-span-1"
            />
          </div>
        </Section>
      )}

      <Section id="shortcuts" title={t("shortcuts")}>
        <TileGrid
          tiles={[
            {
              href: `${base}/seasons`,
              icon: "seasons",
              label: t("tileSeasons"),
            },
            {
              href: `${base}/schedule`,
              icon: "schedule",
              label: t("tileSchedule"),
            },
            {
              href: `${base}/announcements`,
              icon: "announcements",
              label: t("tileAnnouncements"),
            },
            {
              href: `/${league.slug}/standings`,
              icon: "standings",
              label: t("tileStandings"),
            },
            {
              href: `${base}/players`,
              icon: "players",
              label: t("tilePlayers"),
            },
            { href: `/${league.slug}`, icon: "public", label: t("publicNav") },
          ]}
        />
      </Section>

      <details className={cardVariants({ padding: "none" })}>
        <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 font-semibold">
          {t("members")}
          <Badge>{t("memberCount", { count: members.length })}</Badge>
        </summary>
        <ul className="divide-y divide-border border-t">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-4 px-5 py-3">
              <Avatar name={member.name} />
              <div className="min-w-0">
                <p className="break-words font-semibold">
                  {member.name || t("unnamedMember")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {member.roles.join(", ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}
