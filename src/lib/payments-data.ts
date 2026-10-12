import "server-only";
import type { createClient } from "./supabase/server";
import {
  ledgerTotals,
  paymentStatus,
  type LedgerKind,
  type PaymentStatus,
} from "./domain/payments";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Games that count towards a team's fee share: played, being played, or waiting for approval. */
const PLAYED = new Set(["in_progress", "submitted", "approved"]);

export interface LedgerRow {
  id: string;
  kind: LedgerKind;
  amountHalalas: number;
  method: string | null;
  fineReason: string | null;
  reversesId: string | null;
  note: string;
  paidOn: string;
  createdAt: string;
  reversed: boolean;
}

export interface TeamPayments {
  seasonTeamId: string;
  teamName: string;
  divisionName: string;
  quotaHalalas: number;
  paidHalalas: number;
  finesHalalas: number;
  gamesPlayed: number;
  gamesTotal: number;
  status: PaymentStatus;
  entries: LedgerRow[];
}

/**
 * Payment status of every approved team in a season, from the ledger and the
 * schedule. Reads with the viewer's rights: staff see all teams, a team
 * manager only their own.
 */
export async function seasonPayments(
  supabase: Client,
  leagueId: string,
  seasonId: string,
  seasonTeamId?: string,
): Promise<TeamPayments[]> {
  let teamsQuery = supabase
    .from("season_teams")
    .select("id,team_name,fee_halalas,status,divisions(name)")
    .eq("league_id", leagueId)
    .eq("season_id", seasonId)
    .eq("status", "approved");
  if (seasonTeamId) teamsQuery = teamsQuery.eq("id", seasonTeamId);
  const [teams, ledger, games] = await Promise.all([
    teamsQuery.order("team_name"),
    supabase
      .from("team_ledger")
      .select(
        "id,season_team_id,kind,amount_halalas,method,fine_reason,reverses_id,note,paid_on,created_at",
      )
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .order("created_at", { ascending: false }),
    supabase
      .from("games")
      .select("status,home_season_team_id,away_season_team_id")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .neq("status", "cancelled"),
  ]);
  if (teams.error || ledger.error || games.error)
    throw new Error("Unable to load payments.");
  return teams.data.map((team) => {
    const rows = ledger.data.filter((row) => row.season_team_id === team.id);
    const totals = ledgerTotals(
      rows.map((row) => ({
        id: row.id,
        kind: row.kind as LedgerKind,
        amountHalalas: row.amount_halalas,
        reversesId: row.reverses_id,
      })),
    );
    const own = games.data.filter((game) =>
      [game.home_season_team_id, game.away_season_team_id].includes(team.id),
    );
    const gamesPlayed = own.filter((game) => PLAYED.has(game.status)).length;
    return {
      seasonTeamId: team.id,
      teamName: team.team_name,
      divisionName: team.divisions?.name ?? "",
      quotaHalalas: team.fee_halalas,
      paidHalalas: totals.paidHalalas,
      finesHalalas: totals.finesHalalas,
      gamesPlayed,
      gamesTotal: own.length,
      status: paymentStatus({
        quotaHalalas: team.fee_halalas,
        paidHalalas: totals.paidHalalas,
        finesHalalas: totals.finesHalalas,
        gamesTotal: own.length,
        gamesCounted: gamesPlayed,
      }),
      entries: rows.map((row) => ({
        id: row.id,
        kind: row.kind as LedgerKind,
        amountHalalas: row.amount_halalas,
        method: row.method,
        fineReason: row.fine_reason,
        reversesId: row.reverses_id,
        note: row.note,
        paidOn: row.paid_on,
        createdAt: row.created_at,
        reversed: totals.reversedIds.has(row.id),
      })),
    };
  });
}
