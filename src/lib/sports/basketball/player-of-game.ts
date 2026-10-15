import { basketballPerformances } from "./career";
import type { BasketballGameState } from "./reducer";

/** Efficiency is a suggestion only; the commissioner confirms the award. */
export function basketballPlayerOfGameCandidates(state: BasketballGameState) {
  if (state.phase !== "final" || !state.winner) return [];
  return basketballPerformances(state)
    .filter((player) => player.side === state.winner)
    .map((player) => {
      const m = player.metrics;
      return {
        ...player,
        efficiency:
          m.points +
          m.rebounds +
          m.assists +
          m.steals +
          m.blocks -
          (m.fieldGoalAttempts - m.fieldGoals) -
          (m.freeThrowAttempts - m.freeThrows) -
          m.turnovers,
      };
    })
    .sort(
      (a, b) =>
        b.efficiency - a.efficiency ||
        a.name.localeCompare(b.name) ||
        a.playerId.localeCompare(b.playerId),
    );
}
