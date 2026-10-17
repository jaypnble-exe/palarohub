import "server-only";
import type { createClient } from "./supabase/server";
import { suspensionProgress } from "./domain/suspensions";

type Client = Awaited<ReturnType<typeof createClient>>;

/** A player's ejection suspensions, newest first, with games served so far. */
export async function playerSuspensions(
  supabase: Client,
  leagueId: string,
  playerId: string,
) {
  const { data: rows, error } = await supabase
    .from("suspensions")
    .select("id,game_id,season_team_id,games,created_at")
    .eq("league_id", leagueId)
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load suspensions.");
  if (!rows.length) return [];
  const teams = [
    ...new Set(
      rows.flatMap((row) => (row.season_team_id ? [row.season_team_id] : [])),
    ),
  ];
  const ejectionGames = rows.map((row) => row.game_id);
  const [completions, games, played] = await Promise.all([
    supabase
      .from("suspension_completions")
      .select("suspension_id")
      .eq("league_id", leagueId)
      .in(
        "suspension_id",
        rows.map((row) => row.id),
      ),
    teams.length
      ? supabase
          .from("games")
          .select("id,home_season_team_id,away_season_team_id")
          .eq("league_id", leagueId)
          .eq("status", "approved")
          .or(
            `home_season_team_id.in.(${teams.join(",")}),away_season_team_id.in.(${teams.join(",")})`,
          )
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("published_games")
      .select("id,home_team_name,away_team_name")
      .eq("league_id", leagueId)
      .in("id", ejectionGames),
  ]);
  if (completions.error || games.error || played.error)
    throw new Error("Unable to load suspensions.");
  const results = games.data.length
    ? await supabase
        .from("game_results")
        .select("game_id,approved_at")
        .eq("league_id", leagueId)
        .in(
          "game_id",
          games.data.map((game) => game.id),
        )
    : { data: [], error: null };
  if (results.error) throw new Error("Unable to load suspensions.");
  const approvedAt = new Map(
    results.data.map((row) => [row.game_id, row.approved_at]),
  );
  const served = games.data.flatMap((game) => {
    const at = approvedAt.get(game.id);
    return at
      ? [
          {
            id: game.id,
            homeId: game.home_season_team_id,
            awayId: game.away_season_team_id,
            approvedAt: at,
          },
        ]
      : [];
  });
  const done = new Set(completions.data.map((row) => row.suspension_id));
  return rows.map((row) => {
    const game = played.data.find((item) => item.id === row.game_id);
    return {
      id: row.id,
      matchup: game ? `${game.home_team_name} vs ${game.away_team_name}` : "",
      progress: suspensionProgress(
        {
          id: row.id,
          gameId: row.game_id,
          seasonTeamId: row.season_team_id,
          games: row.games,
          createdAt: row.created_at,
          completed: done.has(row.id),
        },
        served,
      ),
    };
  });
}
