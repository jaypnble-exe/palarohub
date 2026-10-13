import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import { DashboardIcon } from "./dashboard-icon";
import { TileGrid } from "./tile-grid";
import { buildTodos, type DashboardTasks } from "./todos";

interface DashboardGame {
  id: string;
  home: string;
  away: string;
  venue: string;
  division: string;
  scheduledAt: string | null;
}

interface DashboardProps {
  league: { name: string; slug: string; sport: string };
  displayName: string;
  role: string;
  members: { id: string; name: string; roles: string[] }[];
  isDemo: boolean;
  seasonName: string | null;
  liveGames: DashboardGame[];
  upcomingGames: DashboardGame[];
  tasks: DashboardTasks;
}

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
  seasonName,
  liveGames,
  upcomingGames,
  tasks,
}: DashboardProps) {
  const t = await getTranslations("AdminHome");
  const sports = await getTranslations("Sports");
  const format = await getFormatter();
  const base = `/admin/${league.slug}`;
  const todos = buildTodos(league.slug, tasks);
  const hour = Number(
    toRiyadhDateTimeInput(new Date().toISOString()).slice(11, 13),
  );
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const when = (game: DashboardGame) =>
    game.scheduledAt
      ? format.dateTime(new Date(game.scheduledAt), {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })
      : t("timeToBeAnnounced");

  return (
    <main className="space-y-7 py-6 sm:space-y-8">
      {isDemo && (
        <div className="rounded-xl border border-primary/30 bg-orange-soft px-4 py-3 text-sm text-orange-dark">
          <strong>{t("demoTitle")}</strong>
          <p className="mt-1">{t("demoDescription")}</p>
        </div>
      )}

      <section
        className="overflow-hidden rounded-2xl bg-navy text-on-dark"
        aria-labelledby="league-heading"
      >
        <div className="h-1.5 bg-primary" />
        <div className="space-y-3 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-on-dark-muted">{role}</p>
            <span className="rounded-full bg-navy-secondary px-3 py-1.5 text-sm font-semibold text-on-dark-muted">
              {sports(league.sport)}
            </span>
          </div>
          <h1
            id="league-heading"
            className="break-words font-display text-4xl font-semibold tracking-wide sm:text-5xl"
          >
            {league.name}
          </h1>
          <p className="text-on-dark-muted">{seasonName ?? t("noSeasonYet")}</p>
        </div>
      </section>

      <section aria-labelledby="todo-heading" className="space-y-3">
        <p className="text-xl font-semibold">
          {displayName
            ? t(`greeting.${greeting}`, { name: displayName })
            : t("welcomeRole", { role })}
        </p>
        <h2 id="todo-heading" className="font-display text-2xl font-semibold">
          {t("todo")}
        </h2>
        {todos.length ? (
          <ul className="space-y-3">
            {todos.map((todo) => (
              <li
                key={todo.key}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3 sm:gap-4 sm:p-4"
              >
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-soft font-display text-2xl font-semibold text-orange-dark"
                  aria-hidden="true"
                >
                  {todo.count}
                </span>
                <span className="min-w-0 flex-1 font-semibold leading-snug">
                  {t(todo.text, { count: todo.count })}
                </span>
                <Link
                  href={todo.href}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-navy px-4 text-sm font-bold text-on-dark hover:bg-navy-secondary"
                >
                  {t(todo.action)}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-green-700 text-white">
              <DashboardIcon name="check" />
            </span>
            <div>
              <p className="font-semibold">{t("allCaughtUp")}</p>
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          </div>
        )}
      </section>

      {liveGames.length > 0 && (
        <section aria-labelledby="live-heading" className="space-y-3">
          <h2
            id="live-heading"
            className="flex items-center gap-2 font-display text-2xl font-semibold"
          >
            <span
              className="size-3 animate-pulse rounded-full bg-destructive"
              aria-hidden="true"
            />
            {t("liveNow")}
          </h2>
          <ul className="space-y-3">
            {liveGames.map((game) => (
              <li key={game.id}>
                <Link
                  href={`${base}/games/${game.id}`}
                  className="block rounded-2xl bg-navy p-4 text-on-dark hover:bg-navy-secondary"
                >
                  <span className="block text-lg font-semibold">
                    {t("matchup", { home: game.home, away: game.away })}
                  </span>
                  <span className="block text-sm text-on-dark-muted">
                    {[game.division, game.venue].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="next-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="next-heading" className="font-display text-2xl font-semibold">
            {t("comingUp")}
          </h2>
          <Link
            href={`${base}/schedule`}
            className="inline-flex min-h-11 items-center font-semibold text-orange-dark"
          >
            {t("fullSchedule")}
          </Link>
        </div>
        {upcomingGames.length ? (
          <ul className="divide-y rounded-2xl border bg-card">
            {upcomingGames.map((game) => (
              <li
                key={game.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 p-4"
              >
                <span className="font-semibold">
                  {t("matchup", { home: game.home, away: game.away })}
                </span>
                <span className="text-sm text-muted-foreground">
                  {when(game)}
                  {game.venue && ` · ${game.venue}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border bg-card p-4 text-muted-foreground">
            {t("noUpcoming")}
          </p>
        )}
      </section>

      <section aria-labelledby="shortcuts-heading" className="space-y-3">
        <h2
          id="shortcuts-heading"
          className="font-display text-2xl font-semibold"
        >
          {t("shortcuts")}
        </h2>
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
      </section>

      <details className="rounded-2xl border bg-card">
        <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 font-semibold">
          {t("members")}
          <span className="rounded-full bg-accent px-3 py-1 text-sm">
            {t("memberCount", { count: members.length })}
          </span>
        </summary>
        <ul className="divide-y divide-border border-t">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-4 px-5 py-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent font-display text-lg font-semibold"
              >
                {member.name ? (
                  member.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                ) : (
                  <DashboardIcon name="players" className="size-5" />
                )}
              </span>
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
