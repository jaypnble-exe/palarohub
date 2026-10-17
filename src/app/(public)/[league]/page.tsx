import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getSiteUrl } from "@/lib/auth";
import { seasonStandings } from "@/lib/standings-data";
import { AnnouncementList } from "@/components/schedule/announcement-list";
import { ShareButtons } from "@/components/share-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";

type HomeGame = {
  id: string | null;
  scheduled_at: string | null;
  venue: string | null;
  division_name: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  outcome: string | null;
};
const gameFields =
  "id,scheduled_at,venue,division_name,home_team_name,away_team_name,home_score,away_score,outcome";

/** A league's public front page: what is on now, next, and how teams stand. */
export default async function PublicLeaguePage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  if (!hasSupabaseConfig()) notFound();
  const supabase = await createClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id,name,sport,logo_url")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Unable to load league.");
  if (!league) notFound();
  const { data: seasons, error: seasonError } = await supabase
    .from("seasons")
    .select("id,name,start_date,end_date,divisions(id,name,sport)")
    .eq("league_id", league.id)
    .eq("status", "published")
    .order("start_date", { ascending: false });
  if (seasonError) throw new Error("Unable to load published seasons.");
  const season = seasons[0];
  const [t, sport, format] = await Promise.all([
    getTranslations("PublicLeague"),
    getTranslations("Sports"),
    getFormatter(),
  ]);

  // Look back a few hours so a game that started late still shows as next.
  const recent = new Date(new Date().getTime() - 3 * 3_600_000).toISOString();
  const leagueId = league.id;
  const noGames = { data: [] as HomeGame[], error: null };
  const seasonGames = (seasonId: string) =>
    supabase
      .from("published_games")
      .select(gameFields)
      .eq("league_id", leagueId)
      .eq("season_id", seasonId);
  const [registration, teams, announcements, live, upcoming, results] =
    await Promise.all([
      supabase
        .from("registration_settings")
        .select("season_id,deadline")
        .eq("league_id", league.id)
        .eq("is_open", true)
        .gt("deadline", new Date().toISOString())
        .order("deadline"),
      season
        ? supabase
            .from("published_season_teams")
            .select("id,team_name,division_name")
            .eq("league_id", league.id)
            .eq("season_id", season.id)
            .order("team_name")
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("announcements")
        .select("id,title,body,created_at,season_id,division_id")
        .eq("league_id", league.id)
        .order("created_at", { ascending: false })
        .limit(10),
      season
        ? seasonGames(season.id)
            .eq("status", "in_progress")
            .order("scheduled_at")
        : noGames,
      season
        ? seasonGames(season.id)
            .eq("status", "scheduled")
            .gte("scheduled_at", recent)
            .order("scheduled_at")
            .limit(4)
        : noGames,
      season
        ? seasonGames(season.id)
            .eq("status", "approved")
            .order("scheduled_at", { ascending: false, nullsFirst: false })
            .limit(4)
        : noGames,
    ]);
  if (
    registration.error ||
    teams.error ||
    announcements.error ||
    live.error ||
    upcoming.error ||
    results.error
  )
    throw new Error("Unable to load public league details.");
  const standings = season
    ? await seasonStandings(supabase, league.id, season.id, season.divisions)
    : [];

  // Signed-in members may also read draft-season posts; keep this page public-only.
  const divisionLabels = new Map(
    seasons.flatMap((item) =>
      item.divisions.map((division) => [
        division.id,
        `${item.name} · ${division.name}`,
      ]),
    ),
  );
  const news = announcements.data
    .filter((item) => !item.division_id || divisionLabels.has(item.division_id))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      createdAt: item.created_at,
      audience: item.division_id
        ? (divisionLabels.get(item.division_id) ?? null)
        : null,
    }));
  const openSeasons = registration.data
    .map((setting) => ({
      ...setting,
      season: seasons.find((item) => item.id === setting.season_id),
    }))
    .filter((setting) => setting.season);
  const teamsByDivision = new Map<string, string[]>();
  for (const team of teams.data ?? []) {
    const key = team.division_name ?? "";
    teamsByDivision.set(key, [
      ...(teamsByDivision.get(key) ?? []),
      team.team_name ?? "",
    ]);
  }
  const divisions = [...teamsByDivision.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const day = (value: string) =>
    format.dateTime(new Date(value), {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  const time = (value: string) =>
    format.dateTime(new Date(value), { hour: "numeric", minute: "2-digit" });
  const date = (value: string) =>
    format.dateTime(new Date(`${value}T12:00:00Z`), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  const tiles: { href: string; icon: IconName; label: string }[] = [
    { href: `/${slug}/schedule`, icon: "schedule", label: t("tileSchedule") },
    {
      href: `/${slug}/standings`,
      icon: "standings",
      label: t("tileStandings"),
    },
    { href: `/${slug}/stats`, icon: "stats", label: t("tileStats") },
    { href: `/${slug}/brackets`, icon: "bracket", label: t("tileBrackets") },
    { href: `/${slug}/awards`, icon: "trophy", label: t("tileAwards") },
  ];

  return (
    <main className="space-y-10 pb-16">
      {/* On phones the hero runs edge to edge, continuing the header. */}
      <section className="-mx-5 bg-navy px-5 pt-8 pb-8 text-on-dark sm:mx-0 sm:mt-6 sm:rounded-3xl sm:px-10 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-on-dark-muted">
              <span
                className="size-2 rounded-full bg-primary"
                aria-hidden="true"
              />
              {sport(league.sport)}
              {season && ` · ${season.name}`}
            </p>
            <div className="flex items-center gap-4">
              {league.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element -- league logos come from Supabase Storage at any size.
                <img
                  src={league.logo_url}
                  alt=""
                  className="size-16 shrink-0 rounded-2xl bg-white object-contain p-1 sm:size-20"
                />
              )}
              <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-wide break-words uppercase sm:text-6xl">
                {league.name}
              </h1>
            </div>
            {season ? (
              <p className="text-on-dark-muted">
                {t("seasonDates", {
                  start: date(season.start_date),
                  end: date(season.end_date),
                })}
                {" · "}
                {t("summary", {
                  teams: teams.data?.length ?? 0,
                  divisions: season.divisions.length,
                })}
              </p>
            ) : (
              <p className="text-on-dark-muted">{t("noSeason")}</p>
            )}
          </div>
        </div>
        {openSeasons.length > 0 && (
          <div className="mt-6 space-y-3 rounded-2xl bg-white/10 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
            {openSeasons.map((setting) => (
              <div key={setting.season_id} className="space-y-1">
                <p className="font-semibold">
                  {t("registerOpen")} · {setting.season!.name}
                </p>
                <p className="text-sm text-on-dark-muted">
                  {t("registerDeadline", {
                    date: format.dateTime(new Date(setting.deadline), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })}
                </p>
              </div>
            ))}
            <Button asChild className="w-full sm:w-auto">
              <Link href={`/${slug}/register/${openSeasons[0].season_id}`}>
                {t("registerTeam")}
                <Icon name="arrow" className="size-5" />
              </Link>
            </Button>
          </div>
        )}
      </section>

      {(live.data ?? []).length > 0 && (
        <Section id="live" title={t("liveTitle")}>
          <ul className="grid gap-3 md:grid-cols-2">
            {live.data!.map((game) => (
              <li
                key={game.id}
                className={cn(cardVariants({ tone: "highlight" }), "space-y-3")}
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Badge tone="primary">
                    <span
                      className="size-2 animate-pulse rounded-full bg-white"
                      aria-hidden="true"
                    />
                    {t("live")}
                  </Badge>
                  <span className="truncate text-muted-foreground">
                    {[game.division_name, game.venue]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <p className="font-display text-xl font-semibold break-words">
                  {game.home_team_name}{" "}
                  <span className="text-muted-foreground">{t("vs")}</span>{" "}
                  {game.away_team_name}
                </p>
                <Button asChild variant="dark" className="w-full">
                  <Link href={`/tv/${game.id}`}>
                    <Icon name="live" className="size-5" />
                    {t("watchLive")}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <nav aria-label={t("explore")}>
        <ul className="grid grid-cols-6 gap-2 sm:grid-cols-5 sm:gap-3">
          {tiles.map((tile, index) => (
            <li
              key={tile.href}
              className={cn(
                index < 3 ? "col-span-2" : "col-span-3",
                "sm:col-span-1",
              )}
            >
              <Link
                href={tile.href}
                className={cn(
                  cardVariants({ interactive: true, padding: "sm" }),
                  "flex h-full min-h-[88px] flex-col items-center justify-center gap-2 text-center",
                )}
              >
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-orange-dark">
                  <Icon name={tile.icon} />
                </span>
                <span className="text-sm leading-tight font-semibold">
                  {tile.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-10">
          <Section
            id="coming-up"
            title={t("comingUp")}
            action={{ href: `/${slug}/schedule`, label: t("fullSchedule") }}
          >
            {(upcoming.data ?? []).length ? (
              <ul className={cn(cardVariants({ padding: "none" }), "divide-y")}>
                {upcoming.data!.map((game) => (
                  <li
                    key={game.id}
                    className="flex items-center gap-4 px-4 py-3"
                  >
                    <span className="w-20 shrink-0 text-center">
                      <span className="block text-xs font-bold text-muted-foreground uppercase">
                        {game.scheduled_at && day(game.scheduled_at)}
                      </span>
                      <span className="block font-display text-lg font-semibold">
                        {game.scheduled_at && time(game.scheduled_at)}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold break-words">
                        {game.home_team_name}{" "}
                        <span className="font-normal text-muted-foreground">
                          {t("vs")}
                        </span>{" "}
                        {game.away_team_name}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {[game.division_name, game.venue]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className={cn(
                  cardVariants({ tone: "muted" }),
                  "text-muted-foreground",
                )}
              >
                {t("nothingComingUp")}
              </p>
            )}
          </Section>

          <Section id="results" title={t("latestResults")}>
            {(results.data ?? []).length ? (
              <ul className={cn(cardVariants({ padding: "none" }), "divide-y")}>
                {results.data!.map((game) => {
                  const home = game.home_score ?? 0;
                  const away = game.away_score ?? 0;
                  const side = (
                    name: string | null,
                    score: number,
                    won: boolean,
                  ) => (
                    <span className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          "min-w-0 break-words",
                          won ? "font-bold" : "text-muted-foreground",
                        )}
                      >
                        {name}
                      </span>
                      <span
                        className={cn(
                          "font-display text-xl tabular-nums",
                          won ? "font-bold" : "text-muted-foreground",
                        )}
                      >
                        {score}
                      </span>
                    </span>
                  );
                  return (
                    <li key={game.id}>
                      <Link
                        href={`/${slug}/games/${game.id}`}
                        aria-label={`${t("viewResult")}: ${game.home_team_name} ${home}, ${game.away_team_name} ${away}`}
                        className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent"
                      >
                        <span className="min-w-0 flex-1 space-y-1">
                          {side(game.home_team_name, home, home > away)}
                          {side(game.away_team_name, away, away > home)}
                          <span className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                            {game.scheduled_at && day(game.scheduled_at)}
                            {game.division_name && ` · ${game.division_name}`}
                            {(game.outcome === "forfeit" ||
                              game.outcome === "default") && (
                              <span className="font-semibold text-orange-dark">
                                {t(
                                  game.outcome === "forfeit"
                                    ? "forfeitNote"
                                    : "defaultNote",
                                )}
                              </span>
                            )}
                          </span>
                        </span>
                        <Icon
                          name="arrow"
                          className="size-5 shrink-0 text-muted-foreground"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p
                className={cn(
                  cardVariants({ tone: "muted" }),
                  "text-muted-foreground",
                )}
              >
                {t("noResults")}
              </p>
            )}
          </Section>
        </div>

        <div className="space-y-10">
          <Section
            id="standings"
            title={t("standingsTitle")}
            action={{ href: `/${slug}/standings`, label: t("fullStandings") }}
          >
            {standings.some((division) => division.gamesCounted > 0) ? (
              <div className="space-y-3">
                {standings
                  .filter((division) => division.rows.length > 0)
                  .map((division) => (
                    <div
                      key={division.divisionId}
                      className={cn(cardVariants({ padding: "none" }))}
                    >
                      <h3 className="border-b px-4 py-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">
                        {division.divisionName}
                      </h3>
                      <table className="w-full text-sm">
                        <thead className="sr-only">
                          <tr>
                            <th scope="col">#</th>
                            <th scope="col">{t("colTeam")}</th>
                            <th scope="col">{t("colRecord")}</th>
                            <th scope="col">{t("colPoints")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {division.rows.slice(0, 4).map((row) => (
                            <tr key={row.teamId}>
                              <td className="w-10 py-2 pl-4 font-display text-base font-semibold text-muted-foreground">
                                {row.rank}
                              </td>
                              <td className="py-2 font-semibold break-words">
                                {row.name}
                              </td>
                              <td className="py-2 text-right text-muted-foreground tabular-nums">
                                {row.wins}–{row.losses}
                              </td>
                              <td className="py-2 pr-4 pl-3 text-right font-bold tabular-nums">
                                {row.points}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </div>
            ) : (
              <p
                className={cn(
                  cardVariants({ tone: "muted" }),
                  "text-muted-foreground",
                )}
              >
                {t("standingsEmpty")}
              </p>
            )}
          </Section>

          {news.length > 0 && (
            <Section id="news" title={t("announcementsTitle")}>
              <AnnouncementList announcements={news} />
            </Section>
          )}
        </div>
      </div>

      <Section id="teams" title={t("teamsTitle")}>
        {divisions.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {divisions.map(([division, names]) => (
              <div key={division} className={cn(cardVariants(), "space-y-3")}>
                <h3 className="flex items-center justify-between gap-2 font-semibold">
                  {division}
                  <Badge>{names.length}</Badge>
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {names.map((name) => (
                    <li
                      key={name}
                      className="rounded-full bg-accent px-3 py-1 text-sm font-medium"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p
            className={cn(
              cardVariants({ tone: "muted" }),
              "text-muted-foreground",
            )}
          >
            {t("teamsEmpty")}
          </p>
        )}
      </Section>

      {seasons.length > 1 && (
        <Section id="seasons" title={t("otherSeasons")}>
          <ul className="flex flex-wrap gap-2">
            {seasons.slice(1).map((item) => (
              <li key={item.id}>
                <Link
                  href={`/${slug}/standings?season=${item.id}`}
                  className="inline-flex min-h-11 items-center rounded-xl border bg-card px-4 font-semibold hover:bg-accent"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <section className={cn(cardVariants(), "space-y-3")}>
        <h2 className="font-display text-xl font-semibold">{t("share")}</h2>
        <ShareButtons
          url={`${getSiteUrl()}/${slug}`}
          text={t("shareText", { league: league.name })}
        />
      </section>
    </main>
  );
}
