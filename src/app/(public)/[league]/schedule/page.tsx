import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getSiteUrl } from "@/lib/auth";
import type { GameLifecycleStatus } from "@/lib/validation/schedule";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/share-buttons";
import { GameList } from "@/components/schedule/game-list";
import { EmptyState } from "@/components/ui/empty-state";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChipLinks } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";

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
        "id,round,scheduled_at,venue,status,home_team_name,away_team_name,division_name,home_score,away_score",
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
    }));
  }
  if (season) games = await loadGames(season.id);
  const path = `/${slug}/schedule`;
  const shareUrl = `${getSiteUrl()}${path}${
    division ? `?division=${division.id}` : season ? `?season=${season.id}` : ""
  }`;
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
              {t("standings")}
            </Link>
          </Button>
        }
      />
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
              href: `${path}?season=${season.id}`,
              label: t("allDivisions"),
              current: !division,
            },
            ...[...season.divisions]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item) => ({
                href: `${path}?division=${item.id}`,
                label: item.name,
                current: item.id === division?.id,
              })),
          ]}
        />
      )}
      {season ? (
        <GameList games={games} />
      ) : (
        <EmptyState title={t("noGames")} />
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
