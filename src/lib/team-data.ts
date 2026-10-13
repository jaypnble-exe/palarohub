import "server-only";
import type { createClient } from "./supabase/server";
import { seasonPayments, type TeamPayments } from "./payments-data";
import type { ScheduleGame } from "./schedule-data";
import type { GameLifecycleStatus } from "./validation/schedule";

type Client = Awaited<ReturnType<typeof createClient>>;

export interface ManagerRegistration {
  id: string;
  teamName: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "returned";
  reviewComment: string;
  seasonId: string;
  seasonName: string;
  divisionName: string;
  changePending: boolean;
}

export interface OpenSeason {
  seasonId: string;
  seasonName: string;
  deadline: string;
  feeHalalas: number;
  /** The manager already has a registration in this season. */
  registered: boolean;
}

export interface ManagerGame extends ScheduleGame {
  /** Which of the manager's registrations plays in this game. */
  registrationId: string;
}

/**
 * Everything a team manager needs on one screen, read with their own
 * rights: only their teams, their registrations, and their own payments.
 */
export async function managerOverview(
  supabase: Client,
  leagueId: string,
  userId: string,
) {
  const [teams, settings] = await Promise.all([
    supabase
      .from("teams")
      .select("id")
      .eq("league_id", leagueId)
      .eq("manager_id", userId),
    supabase
      .from("registration_settings")
      .select("season_id,deadline,fee_halalas,seasons!inner(name,status)")
      .eq("league_id", leagueId)
      .eq("is_open", true)
      .eq("seasons.status", "published")
      .gt("deadline", new Date().toISOString())
      .order("deadline"),
  ]);
  if (teams.error || settings.error)
    throw new Error("Unable to load your teams.");
  const teamIds = teams.data.map((team) => team.id);
  const rows = teamIds.length
    ? await supabase
        .from("season_teams")
        .select(
          "id,team_name,status,review_comment,season_id,created_at,seasons(name),divisions(name)",
        )
        .eq("league_id", leagueId)
        .in("team_id", teamIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (rows.error) throw new Error("Unable to load your registrations.");
  const ids = rows.data.map((row) => row.id);
  const approved = rows.data.filter((row) => row.status === "approved");
  const approvedIds = approved.map((row) => row.id);
  const [changes, games, payments] = await Promise.all([
    ids.length
      ? supabase
          .from("roster_change_requests")
          .select("registration_id")
          .eq("league_id", leagueId)
          .eq("status", "submitted")
          .in("registration_id", ids)
      : { data: [], error: null },
    approvedIds.length
      ? supabase
          .from("published_games")
          .select(
            "id,round,scheduled_at,venue,status,division_name,home_season_team_id,away_season_team_id,home_team_name,away_team_name,home_score,away_score",
          )
          .eq("league_id", leagueId)
          .or(
            `home_season_team_id.in.(${approvedIds.join(",")}),away_season_team_id.in.(${approvedIds.join(",")})`,
          )
          .neq("status", "cancelled")
          .order("scheduled_at", { nullsFirst: false })
      : { data: [], error: null },
    Promise.all(
      approved.map(async (row) => {
        const [team] = await seasonPayments(
          supabase,
          leagueId,
          row.season_id,
          row.id,
        );
        return team;
      }),
    ),
  ]);
  if (changes.error || games.error) throw new Error("Unable to load games.");
  const pending = new Set(changes.data.map((row) => row.registration_id));
  const registrations: ManagerRegistration[] = rows.data.map((row) => ({
    id: row.id,
    teamName: row.team_name,
    status: row.status as ManagerRegistration["status"],
    reviewComment: row.review_comment,
    seasonId: row.season_id,
    seasonName: row.seasons?.name ?? "",
    divisionName: row.divisions?.name ?? "",
    changePending: pending.has(row.id),
  }));
  const seasonsRegistered = new Set(rows.data.map((row) => row.season_id));
  const openSeasons: OpenSeason[] = settings.data.map((setting) => ({
    seasonId: setting.season_id,
    seasonName: setting.seasons.name,
    deadline: setting.deadline,
    feeHalalas: setting.fee_halalas,
    registered: seasonsRegistered.has(setting.season_id),
  }));
  const mine = new Set(approvedIds);
  const managerGames: ManagerGame[] = games.data.map((game) => ({
    id: game.id ?? "",
    round: game.round,
    scheduledAt: game.scheduled_at,
    venue: game.venue ?? "",
    status: (game.status ?? "scheduled") as GameLifecycleStatus,
    homeName: game.home_team_name ?? "",
    awayName: game.away_team_name ?? "",
    divisionName: game.division_name ?? undefined,
    homeScore: game.home_score,
    awayScore: game.away_score,
    registrationId: mine.has(game.home_season_team_id ?? "")
      ? (game.home_season_team_id ?? "")
      : (game.away_season_team_id ?? ""),
  }));
  return {
    registrations,
    openSeasons,
    games: managerGames,
    payments: payments.filter((team): team is TeamPayments => Boolean(team)),
  };
}
export type ManagerOverview = Awaited<ReturnType<typeof managerOverview>>;
