import "server-only";
import type { createClient } from "./supabase/server";
import { computeStandings, type StandingsRow } from "./domain/standings";
import { getSportModule } from "./sports/registry";

type Client = Awaited<ReturnType<typeof createClient>>;

export interface DivisionStandings {
  divisionId: string;
  divisionName: string;
  rows: StandingsRow[];
  gamesCounted: number;
}

/**
 * Standings for every division of a published season, from approved results
 * only. Uses the public views, so they match what visitors can see.
 */
export async function seasonStandings(
  supabase: Client,
  leagueId: string,
  seasonId: string,
  divisions: readonly { id: string; name: string; sport: string }[],
): Promise<DivisionStandings[]> {
  const [teams, games] = await Promise.all([
    supabase
      .from("published_season_teams")
      .select("id,division_id,team_name")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId),
    supabase
      .from("published_games")
      .select(
        "division_id,home_season_team_id,away_season_team_id,home_score,away_score",
      )
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("status", "approved"),
  ]);
  if (teams.error || games.error) throw new Error("Unable to load standings.");
  return [...divisions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((division) => {
      const sport = getSportModule(division.sport);
      const results = games.data.flatMap((game) =>
        game.division_id === division.id &&
        game.home_season_team_id &&
        game.away_season_team_id &&
        game.home_score !== null &&
        game.away_score !== null
          ? [
              {
                homeId: game.home_season_team_id,
                awayId: game.away_season_team_id,
                homeScore: game.home_score,
                awayScore: game.away_score,
              },
            ]
          : [],
      );
      return {
        divisionId: division.id,
        divisionName: division.name,
        gamesCounted: results.length,
        rows: computeStandings(
          teams.data.flatMap((team) =>
            team.division_id === division.id && team.id
              ? [{ id: team.id, name: team.team_name ?? "" }]
              : [],
          ),
          results,
          {
            points: sport.standingsPoints,
            tiebreakers: sport.tiebreakers,
          },
        ),
      };
    });
}
