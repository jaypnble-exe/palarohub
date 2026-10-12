import "server-only";
import type { createClient } from "./supabase/server";
import type { GameStatus } from "./validation/schedule";

type Client = Awaited<ReturnType<typeof createClient>>;

export interface ScheduleGame {
  id: string;
  round: number | null;
  scheduledAt: string | null;
  venue: string;
  status: GameStatus;
  homeName: string;
  awayName: string;
  divisionName?: string;
}

export interface DivisionOverview {
  id: string;
  name: string;
  seasonId: string;
  seasonName: string;
  teamCount: number;
  gameCount: number;
}

/** Published-season divisions with their approved-team and game counts. */
export async function scheduleOverview(
  supabase: Client,
  leagueId: string,
): Promise<DivisionOverview[]> {
  const [seasons, teams, games] = await Promise.all([
    supabase
      .from("seasons")
      .select("id,name,divisions(id,name)")
      .eq("league_id", leagueId)
      .eq("status", "published")
      .order("start_date", { ascending: false }),
    supabase
      .from("season_teams")
      .select("division_id")
      .eq("league_id", leagueId)
      .eq("status", "approved"),
    supabase.from("games").select("division_id").eq("league_id", leagueId),
  ]);
  if (seasons.error || teams.error || games.error)
    throw new Error("Unable to load schedules.");
  const count = (rows: { division_id: string }[], id: string) =>
    rows.filter((row) => row.division_id === id).length;
  return seasons.data.flatMap((season) =>
    [...season.divisions]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((division) => ({
        id: division.id,
        name: division.name,
        seasonId: season.id,
        seasonName: season.name,
        teamCount: count(teams.data, division.id),
        gameCount: count(games.data, division.id),
      })),
  );
}

/** One division's approved teams (in generator order) and its games. */
export async function divisionSchedule(
  supabase: Client,
  leagueId: string,
  divisionId: string,
) {
  const [division, teams, games] = await Promise.all([
    supabase
      .from("divisions")
      .select("id,name,season_id,seasons(name,status,start_date,end_date)")
      .eq("league_id", leagueId)
      .eq("id", divisionId)
      .maybeSingle(),
    supabase
      .from("season_teams")
      .select("id,team_name")
      .eq("league_id", leagueId)
      .eq("division_id", divisionId)
      .eq("status", "approved")
      .order("team_name")
      .order("id"),
    supabase
      .from("games")
      .select(
        "id,round,scheduled_at,venue,status,home_season_team_id,away_season_team_id",
      )
      .eq("league_id", leagueId)
      .eq("division_id", divisionId)
      .order("scheduled_at", { nullsFirst: false })
      .order("venue"),
  ]);
  if (division.error || teams.error || games.error)
    throw new Error("Unable to load the division schedule.");
  if (!division.data) return null;
  const names = new Map(teams.data.map((team) => [team.id, team.team_name]));
  return {
    division: division.data,
    teams: teams.data.map((team) => ({ id: team.id, name: team.team_name })),
    games: games.data.map((game): ScheduleGame => ({
      id: game.id,
      round: game.round,
      scheduledAt: game.scheduled_at,
      venue: game.venue,
      status: game.status as GameStatus,
      homeName: names.get(game.home_season_team_id) ?? "",
      awayName: names.get(game.away_season_team_id) ?? "",
    })),
  };
}
