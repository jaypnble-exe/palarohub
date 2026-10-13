import "server-only";
import type { createClient } from "./supabase/server";
import { parseGameEvents } from "./game-events";
import { getSportModule } from "./sports/registry";
import type { LiveScore } from "./sports/types";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * The score so far for games being played, rebuilt from their event logs
 * by each game's sport module, with the viewer's own access rights.
 */
export async function liveScores(
  supabase: Client,
  leagueId: string,
  gameIds: readonly string[],
): Promise<Map<string, LiveScore>> {
  const scores = new Map<string, LiveScore>();
  if (!gameIds.length) return scores;
  const [games, rows] = await Promise.all([
    supabase
      .from("games")
      .select("id,divisions(sport,rules,seasons(rules))")
      .eq("league_id", leagueId)
      .in("id", gameIds),
    supabase
      .from("game_events")
      .select("game_id,id,sequence,type,payload,clock_ms,occurred_at")
      .eq("league_id", leagueId)
      .in("game_id", gameIds)
      .order("sequence"),
  ]);
  if (games.error || rows.error) throw new Error("Unable to load live scores.");
  for (const game of games.data) {
    const division = game.divisions;
    if (!division?.seasons) continue;
    const sport = getSportModule(division.sport);
    const rules = sport.rulesSchema.parse(
      division.rules ?? division.seasons.rules,
    );
    const { events } = parseGameEvents(
      division.sport,
      rows.data.filter((row) => row.game_id === game.id),
    );
    // The module's own types: events and rules come from the same module.
    const state = sport.reduceGame(events as never, rules as never);
    scores.set(game.id, sport.liveScore(state as never, rules as never));
  }
  return scores;
}
