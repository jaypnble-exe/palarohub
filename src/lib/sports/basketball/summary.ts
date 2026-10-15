import type { GameSummary } from "../types";
import { sides, type Side } from "./events";
import { boxScore, type BasketballGameState } from "./reducer";

/**
 * The official record of a finished game, stored when staff approve it.
 * Returns null until the final buzzer. Only ejections (not foul-outs) are
 * offered as suspensions; fouling out is not misconduct.
 */
export function summarizeBasketballGame(
  state: BasketballGameState,
  teamNames: Record<Side, string>,
): GameSummary | null {
  if (state.phase !== "final" || !state.winner) return null;
  const teams = Object.fromEntries(
    sides.map((side) => {
      const team = state.teams[side];
      const { rows, totals } = boxScore(state, side);
      return [
        side,
        {
          name: teamNames[side],
          score: team.score,
          pointsByPeriod: team.pointsByPeriod,
          teamFouls: team.teamFouls,
          timeoutsUsed: team.timeoutsUsed,
          benchTechnicals: team.benchTechnicals,
          coachFouls: team.coachFouls,
          coachEjected: team.coachEjected,
          coach: team.coach,
          assistantCoach: team.assistantCoach,
          captainId: team.captainId,
          timeouts: team.timeouts,
          shotClockViolations: team.shotClockViolations,
          players: rows.map((row) => ({
            ...row,
            entered: team.players[row.playerId].entered,
          })),
          totals,
        },
      ];
    }),
  );
  return {
    homeScore: state.teams.home.score,
    awayScore: state.teams.away.score,
    summary: {
      sport: "basketball",
      periods: state.period,
      winner: state.winner,
      officials: state.officials,
      confirmations: state.confirmations,
      protests: state.protests,
      teams,
    },
    ejectedPlayers: sides.flatMap((side) =>
      state.teams[side].playerIds
        .map((id) => state.teams[side].players[id])
        .filter((line) => line.disqualified === "ejected")
        .map((line) => ({
          playerId: line.playerId,
          name: line.name,
          jersey: line.jersey,
          team: side,
        })),
    ),
  };
}
