import type { BasketballGameState } from "./reducer";
import { sides } from "./events";
import type { PlayerPerformance } from "@/lib/domain/career-stats";

export function basketballPerformances(
  state: BasketballGameState,
): (PlayerPerformance & { side: "home" | "away" })[] {
  return sides.flatMap((side) =>
    state.teams[side].playerIds.flatMap((id) => {
      const line = state.teams[side].players[id];
      if (!line.entered) return [];
      return [
        {
          playerId: id,
          name: line.name,
          side,
          metrics: {
            points: line.points,
            minutes: line.playedMs / 60_000,
            rebounds: line.stats.rebound,
            assists: line.stats.assist,
            steals: line.stats.steal,
            blocks: line.stats.block,
            turnovers: line.stats.turnover,
            fouls: line.foulCount,
            fieldGoals: line.twoPointers.made + line.threePointers.made,
            fieldGoalAttempts:
              line.twoPointers.attempted + line.threePointers.attempted,
            threePointers: line.threePointers.made,
            threePointAttempts: line.threePointers.attempted,
            freeThrows: line.freeThrows.made,
            freeThrowAttempts: line.freeThrows.attempted,
          },
        },
      ];
    }),
  );
}
