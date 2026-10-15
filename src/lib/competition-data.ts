import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "./supabase/server";
import { hasSupabaseConfig } from "./supabase/env";
import { z } from "zod";
import type { Json } from "./supabase/database.types";
import { parseGameEvents } from "./game-events";
import { getSportModule } from "./sports/registry";
import type { PlayerGame } from "./domain/career-stats";

export const competitionContext = cache(async (slug: string) => {
  if (!hasSupabaseConfig()) notFound();
  const supabase = await createClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Unable to load league.");
  if (!league) notFound();
  const seasons = await supabase
    .from("seasons")
    .select("id,name,divisions(id,name,sport)")
    .eq("league_id", league.id)
    .eq("status", "published")
    .order("start_date", { ascending: false });
  if (seasons.error) throw new Error("Unable to load seasons.");
  return { supabase, league, seasons: seasons.data };
});

const gamesSchema = z.array(
  z.object({
    id: z.uuid(),
    seasonId: z.uuid(),
    seasonName: z.string(),
    divisionId: z.uuid(),
    divisionName: z.string(),
    sport: z.string(),
    rules: z.unknown(),
    playedAt: z.string().nullable(),
    homeName: z.string(),
    awayName: z.string(),
    homeScore: z.number(),
    awayScore: z.number(),
    events: z.array(
      z.object({
        id: z.uuid(),
        sequence: z.number(),
        type: z.string(),
        payload: z.custom<Json>(),
        clock_ms: z.number().nullable(),
        occurred_at: z.string(),
      }),
    ),
  }),
);

export async function careerGames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leagueId: string,
  seasonId?: string,
  playerId?: string,
) {
  const { data, error } = await supabase.rpc("career_games", {
    p_league_id: leagueId,
    p_season_id: seasonId,
    p_player_id: playerId,
  });
  if (error) throw new Error("Unable to load approved player statistics.");
  const source = gamesSchema.parse(data);
  const games: PlayerGame[] = [];
  let unreadableGames = 0;
  for (const game of source) {
    const sport = getSportModule(game.sport);
    const parsed = parseGameEvents(game.sport, game.events);
    if (parsed.invalid.length) {
      unreadableGames++;
      continue;
    }
    const state = sport.reduceGame(
      parsed.events,
      sport.rulesSchema.parse(game.rules),
    );
    // A result with an unreadable/incomplete scoring history must not inflate careers.
    const summary = sport.summarizeGame(state, {
      home: game.homeName,
      away: game.awayName,
    });
    if (
      !summary ||
      summary.homeScore !== game.homeScore ||
      summary.awayScore !== game.awayScore
    ) {
      unreadableGames++;
      continue;
    }
    for (const player of sport.playerPerformances(state)) {
      if (playerId && player.playerId !== playerId) continue;
      const home = player.side === "home";
      games.push({
        ...player,
        gameId: game.id,
        seasonId: game.seasonId,
        seasonName: game.seasonName,
        divisionId: game.divisionId,
        divisionName: game.divisionName,
        teamName: home ? game.homeName : game.awayName,
        opponent: home ? game.awayName : game.homeName,
        sport: game.sport,
        playedAt: game.playedAt,
        won: home
          ? game.homeScore > game.awayScore
          : game.awayScore > game.homeScore,
      });
    }
  }
  return { games, unreadableGames };
}

export async function bracketData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leagueId: string,
  seasonId: string,
) {
  const [brackets, slots, teams, games] = await Promise.all([
    supabase
      .from("brackets")
      .select("id,division_id,preset,seeds")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId),
    supabase
      .from("bracket_slots")
      .select(
        "id,bracket_id,division_id,round_no,position,home_seed,away_seed,home_source,away_source,home_team_id,away_team_id,winner_id,home_required,away_required",
      )
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("round_no")
      .order("position"),
    supabase
      .from("published_season_teams")
      .select("id,team_name,division_id")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId),
    supabase
      .from("published_games")
      .select(
        "id,division_id,bracket_slot_id,bracket_game_number,status,home_season_team_id,away_season_team_id,home_score,away_score,scheduled_at,venue",
      )
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("bracket_game_number"),
  ]);
  if ([brackets, slots, teams, games].some((result) => result.error))
    throw new Error("Unable to load brackets.");
  return {
    brackets: brackets.data ?? [],
    slots: slots.data ?? [],
    teams: teams.data ?? [],
    games: games.data ?? [],
  };
}
export type BracketData = Awaited<ReturnType<typeof bracketData>>;
