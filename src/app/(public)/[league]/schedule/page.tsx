import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getSiteUrl } from "@/lib/auth";
import type { GameStatus } from "@/lib/validation/schedule";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/share-buttons";
import { GameList } from "@/components/schedule/game-list";

export default async function PublicSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ season?: string; division?: string }>;
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
        "id,round,scheduled_at,venue,status,home_team_name,away_team_name,division_name",
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
      status: (game.status ?? "scheduled") as GameStatus,
      homeName: game.home_team_name ?? "",
      awayName: game.away_team_name ?? "",
      divisionName: division ? undefined : (game.division_name ?? undefined),
    }));
  }
  if (season) games = await loadGames(season.id);
  const path = `/${slug}/schedule`;
  const shareUrl = `${getSiteUrl()}${path}${
    division ? `?division=${division.id}` : season ? `?season=${season.id}` : ""
  }`;
  const chip =
    "inline-flex min-h-11 items-center rounded-xl border-2 bg-background px-4 font-semibold aria-[current=true]:border-navy aria-[current=true]:bg-navy aria-[current=true]:text-on-dark";
  return (
    <main className="space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/${slug}`}>{league.name}</Link>
      </Button>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">
          {t("publicTitle")}
        </h1>
        {season && <p className="text-muted-foreground">{season.name}</p>}
      </div>
      {seasons.length > 1 && (
        <nav aria-label={t("chooseSeason")} className="flex flex-wrap gap-2">
          {seasons.map((item) => (
            <Link
              key={item.id}
              href={`${path}?season=${item.id}`}
              aria-current={item.id === season?.id}
              className={chip}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      )}
      {season && season.divisions.length > 1 && (
        <nav aria-label={t("chooseDivision")} className="flex flex-wrap gap-2">
          <Link
            href={`${path}?season=${season.id}`}
            aria-current={!division}
            className={chip}
          >
            {t("allDivisions")}
          </Link>
          {[...season.divisions]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item) => (
              <Link
                key={item.id}
                href={`${path}?division=${item.id}`}
                aria-current={item.id === division?.id}
                className={chip}
              >
                {item.name}
              </Link>
            ))}
        </nav>
      )}
      {season ? (
        <GameList games={games} />
      ) : (
        <p className="rounded-2xl border bg-card p-5">{t("noGames")}</p>
      )}
      {games.length > 0 && (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
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
