import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { liveScores } from "@/lib/live-scores";
import { AccessDenied } from "@/components/access-denied";
import { GamesBoard, type BoardGame } from "@/components/admin/games-board";
import { PageHeader } from "@/components/ui/page-header";

const approvedLimit = 20;
const fields =
  "id,status,scheduled_at,venue,division_name,home_team_name,away_team_name,home_score,away_score,outcome";

/** Games waiting for approval first, then games being played, the week ahead, and recent results. */
export default async function GamesPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const now = new Date().getTime();
  const [open, approved, upcoming] = await Promise.all([
    supabase
      .from("published_games")
      .select(fields)
      .eq("league_id", league.id)
      .in("status", ["submitted", "in_progress"])
      .order("scheduled_at"),
    supabase
      .from("published_games")
      .select(fields)
      .eq("league_id", league.id)
      .eq("status", "approved")
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(approvedLimit),
    supabase
      .from("published_games")
      .select(fields)
      .eq("league_id", league.id)
      .eq("status", "scheduled")
      // A game that started late still counts as coming up for a few hours.
      .gte("scheduled_at", new Date(now - 3 * 3_600_000).toISOString())
      .lt("scheduled_at", new Date(now + 7 * 86_400_000).toISOString())
      .order("scheduled_at"),
  ]);
  if (open.error || approved.error || upcoming.error)
    throw new Error("Unable to load games.");
  const submittedIds = open.data
    .filter((game) => game.status === "submitted")
    .map((game) => game.id ?? "");
  const [sent, scores] = await Promise.all([
    submittedIds.length
      ? supabase
          .from("game_reviews")
          .select("game_id,created_at")
          .eq("league_id", league.id)
          .eq("action", "submitted")
          .in("game_id", submittedIds)
      : { data: [], error: null },
    liveScores(
      supabase,
      league.id,
      open.data
        .filter((game) => game.status === "in_progress")
        .map((game) => game.id ?? ""),
    ),
  ]);
  if (sent.error) throw new Error("Unable to load game reviews.");
  const sentAt = new Map<string, string>();
  for (const review of sent.data ?? [])
    if ((sentAt.get(review.game_id) ?? "") < review.created_at)
      sentAt.set(review.game_id, review.created_at);
  const games: BoardGame[] = [
    ...open.data,
    ...upcoming.data,
    ...approved.data,
  ].map((game) => ({
    id: game.id ?? "",
    status: game.status as BoardGame["status"],
    scheduledAt: game.scheduled_at,
    venue: game.venue ?? "",
    divisionName: game.division_name ?? "",
    homeName: game.home_team_name ?? "",
    awayName: game.away_team_name ?? "",
    homeScore: game.home_score,
    awayScore: game.away_score,
    outcome: game.outcome,
    sentAt: sentAt.get(game.id ?? "") ?? null,
  }));
  const t = await getTranslations("Review");
  return (
    <main className="mx-auto max-w-4xl space-y-6 py-6">
      <PageHeader
        title={t("adminGamesTitle")}
        description={t("adminGamesIntro")}
      />
      <GamesBoard
        slug={slug}
        games={games}
        scores={scores}
        approvedLimit={approvedLimit}
      />
    </main>
  );
}
