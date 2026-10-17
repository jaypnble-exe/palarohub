import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getSiteUrl } from "@/lib/auth";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import type { GameLifecycleStatus } from "@/lib/validation/schedule";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/share-buttons";
import { ScheduleDays } from "@/components/public/schedule-days";
import { EmptyState } from "@/components/ui/empty-state";
import { cardVariants } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/stat";
import { cn } from "@/lib/utils";
import { ChipLinks } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";

const views = ["upcoming", "results", "all"] as const;
type View = (typeof views)[number];
const finished: readonly GameLifecycleStatus[] = ["approved", "cancelled"];

export default async function PublicSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ season?: string; division?: string; view?: string }>;
}) {
  const { league: slug } = await params;
  const query = await searchParams;
  if (!hasSupabaseConfig()) notFound();
  const supabase = await createClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Unable to load league.");
  if (!league) notFound();
  const { data: seasons, error: seasonError } = await supabase
    .from("seasons")
    .select("id,name,divisions(id,name)")
    .eq("league_id", league.id)
    .eq("status", "published")
    .order("start_date", { ascending: false });
  if (seasonError) throw new Error("Unable to load seasons.");
  const season =
    seasons.find((item) => item.id === query.season) ??
    seasons.find((item) =>
      item.divisions.some((division) => division.id === query.division),
    ) ??
    seasons[0];
  const division = season?.divisions.find((item) => item.id === query.division);
  const t = await getTranslations("Schedule");
  const leagueId = league.id;
  let games: Awaited<ReturnType<typeof loadGames>> = [];
  async function loadGames(seasonId: string) {
    let request = supabase
      .from("published_games")
      .select(
        "id,round,scheduled_at,venue,status,home_team_name,away_team_name,division_name,home_score,away_score,outcome,forfeited_by",
      )
      .eq("league_id", leagueId)
      .eq("season_id", seasonId);
    if (division) request = request.eq("division_id", division.id);
    const { data, error: gameError } = await request
      .order("scheduled_at", { nullsFirst: false })
      .order("venue");
    if (gameError) throw new Error("Unable to load the schedule.");
    return data.map((game) => ({
      id: game.id ?? "",
      round: game.round,
      scheduledAt: game.scheduled_at,
      venue: game.venue ?? "",
      status: (game.status ?? "scheduled") as GameLifecycleStatus,
      homeName: game.home_team_name ?? "",
      awayName: game.away_team_name ?? "",
      divisionName: division ? undefined : (game.division_name ?? undefined),
      homeScore: game.home_score,
      awayScore: game.away_score,
      outcome: game.outcome,
      forfeitedBy: game.forfeited_by,
    }));
  }
  if (season) games = await loadGames(season.id);

  const upcoming = games.filter((game) => !finished.includes(game.status));
  const results = games.filter((game) => game.status === "approved");
  const counted = games.filter((game) => game.status !== "cancelled");
  // Open on what fans look for most: the next games, or the results once the season is over.
  const view: View =
    views.find((item) => item === query.view) ??
    (upcoming.length ? "upcoming" : "all");
  const shown =
    view === "upcoming" ? upcoming : view === "results" ? results : games;
  const path = `/${slug}/schedule`;
  const link = (changes: { view?: View; division?: string | null }) => {
    const search = new URLSearchParams();
    const nextDivision =
      changes.division === undefined ? division?.id : changes.division;
    if (nextDivision) search.set("division", nextDivision);
    else if (season) search.set("season", season.id);
    const nextView = changes.view ?? view;
    if (nextView !== "upcoming") search.set("view", nextView);
    return `${path}?${search}`;
  };
  const shareUrl = `${getSiteUrl()}${path}${
    division ? `?division=${division.id}` : season ? `?season=${season.id}` : ""
  }`;
  const today = toRiyadhDateTimeInput(new Date().toISOString()).slice(0, 10);

  return (
    <main className="space-y-6 py-6">
      <PageHeader
        back={{ href: `/${slug}`, label: league.name }}
        eyebrow={season?.name}
        title={t("publicTitle")}
        actions={
          <Button asChild variant="outline">
            <Link
              href={`/${slug}/standings${season ? `?season=${season.id}` : ""}`}
            >
              <Icon name="standings" className="size-5" />
              {t("standings")}
            </Link>
          </Button>
        }
      />
      {counted.length > 0 && (
        <div className="max-w-md space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {t("publicProgress", {
              played: results.length,
              total: counted.length,
            })}
          </p>
          <Progress
            value={results.length}
            max={counted.length}
            label={t("publicProgress", {
              played: results.length,
              total: counted.length,
            })}
          />
        </div>
      )}
      <div className="space-y-3">
        {seasons.length > 1 && (
          <ChipLinks
            label={t("chooseSeason")}
            links={seasons.map((item) => ({
              href: `${path}?season=${item.id}`,
              label: item.name,
              current: item.id === season?.id,
            }))}
          />
        )}
        {season && season.divisions.length > 1 && (
          <ChipLinks
            label={t("chooseDivision")}
            links={[
              {
                href: link({ division: null }),
                label: t("allDivisions"),
                current: !division,
              },
              ...[...season.divisions]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => ({
                  href: link({ division: item.id }),
                  label: item.name,
                  current: item.id === division?.id,
                })),
            ]}
          />
        )}
        {games.length > 0 && (
          <nav
            aria-label={t("chooseView")}
            className="inline-flex rounded-2xl bg-accent p-1"
          >
            {views.map((item) => (
              <Link
                key={item}
                href={link({ view: item })}
                aria-current={item === view ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
                  item === view && "bg-card text-foreground shadow-sm",
                )}
              >
                {t(`view.${item}`)}
                <span className="text-xs tabular-nums opacity-70">
                  {item === "upcoming"
                    ? upcoming.length
                    : item === "results"
                      ? results.length
                      : games.length}
                </span>
              </Link>
            ))}
          </nav>
        )}
      </div>
      {!season || games.length === 0 ? (
        <EmptyState icon="schedule" title={t("noGames")} />
      ) : shown.length ? (
        <ScheduleDays
          slug={slug}
          games={shown}
          newestFirst={view === "results"}
          today={today}
        />
      ) : (
        <EmptyState icon="schedule" title={t(`viewEmpty.${view}`)} />
      )}
      {games.length > 0 && (
        <section className={cn(cardVariants(), "space-y-3")}>
          <h2 className="font-display text-xl font-semibold">
            {t("shareSchedule")}
          </h2>
          <ShareButtons
            url={shareUrl}
            text={t("shareText", {
              division: division?.name ?? season?.name ?? league.name,
            })}
          />
        </section>
      )}
    </main>
  );
}
