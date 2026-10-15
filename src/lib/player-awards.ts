import "server-only";
import { z } from "zod";
import type { createClient } from "./supabase/server";

const awardSchema = z.object({
  game_id: z.uuid(),
  player_id: z.uuid(),
  player_name: z.string(),
  efficiency: z.number(),
  metrics: z.record(z.string(), z.number()),
});

/** Public RLS exposes awards only for approved games in published seasons. */
export async function loadPlayerAwards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leagueId: string,
  filter: { gameId?: string; playerId?: string } = {},
) {
  let query = supabase
    .from("game_player_awards")
    .select("game_id,player_id,player_name,efficiency,metrics")
    .eq("league_id", leagueId)
    .order("confirmed_at", { ascending: false });
  if (filter.gameId) query = query.eq("game_id", filter.gameId);
  if (filter.playerId) query = query.eq("player_id", filter.playerId);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load confirmed game awards.");
  return z.array(awardSchema).parse(data);
}
