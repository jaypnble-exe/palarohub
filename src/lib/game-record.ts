import "server-only";
import type { createClient } from "./supabase/server";
import { parseGameEvents } from "./game-events";
import { getSportModule } from "./sports/registry";
import type {
  BasketballEvent,
  BasketballGameState,
  BasketballRules,
} from "./sports/basketball";
import type { GameLifecycleStatus } from "./validation/schedule";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Rebuilds one game from its event log with the viewer's own access rights.
 * Returns null when the game does not exist or is not visible to the viewer.
 */
export async function loadGameRecord(supabase: Client, gameId: string) {
  const { data: game, error } = await supabase
    .from("games")
    .select(
      "id,league_id,status,scheduled_at,venue,round,season_id,division_id,divisions(name,sport,rules,seasons(name,rules)),leagues(name)",
    )
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error("Unable to load the game.");
  if (!game?.divisions?.seasons) return null;
  const [teams, rows, result, reviews] = await Promise.all([
    supabase
      .from("published_games")
      .select("home_team_name,away_team_name")
      .eq("id", gameId)
      .maybeSingle(),
    supabase
      .from("game_events")
      .select("id,sequence,type,payload,clock_ms,occurred_at")
      .eq("game_id", gameId)
      .order("sequence"),
    supabase
      .from("game_results")
      .select("*")
      .eq("game_id", gameId)
      .maybeSingle(),
    supabase
      .from("game_reviews")
      .select("action,comment,created_at")
      .eq("game_id", gameId)
      .order("created_at"),
  ]);
  if (teams.error || rows.error || result.error || reviews.error)
    throw new Error("Unable to load the game record.");
  const division = game.divisions;
  const season = division.seasons!;
  const sport = getSportModule(division.sport);
  const rules = sport.rulesSchema.parse(division.rules ?? season.rules);
  const { events, invalid } = parseGameEvents(division.sport, rows.data);
  const state = sport.reduceGame(events as BasketballEvent[], rules);
  const teamNames = {
    home: teams.data?.home_team_name ?? "",
    away: teams.data?.away_team_name ?? "",
  };
  return {
    game: {
      id: game.id,
      leagueId: game.league_id,
      status: game.status as GameLifecycleStatus,
      scheduledAt: game.scheduled_at,
      venue: game.venue,
      round: game.round,
    },
    leagueName: game.leagues?.name ?? "",
    seasonName: season.name,
    divisionName: division.name,
    sport: division.sport,
    rules: rules as BasketballRules,
    teamNames,
    events: events as BasketballEvent[],
    /** Highest stored sequence, including any rows the sport module could not read. */
    lastSequence: rows.data.at(-1)?.sequence ?? 0,
    unreadableEvents: invalid.length,
    state: state as BasketballGameState,
    summary: sport.summarizeGame(state, teamNames),
    result: result.data,
    reviews: reviews.data,
  };
}
export type GameRecord = NonNullable<
  Awaited<ReturnType<typeof loadGameRecord>>
>;
