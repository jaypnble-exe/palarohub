/** A suspension from an ejection, served by the team the player was with. */
export interface SuspensionRecord {
  id: string;
  gameId: string;
  seasonTeamId: string | null;
  games: number;
  createdAt: string;
  completed: boolean;
}

/** An approved game, with the teams and when its result became official. */
export interface ServedGame {
  id: string;
  homeId: string;
  awayId: string;
  approvedAt: string;
}

/**
 * How many games of a suspension are served: the team's approved games after
 * the suspension, not counting the game of the ejection itself. The database
 * applies the same rule when it lifts a served suspension.
 */
export function suspensionProgress(
  suspension: SuspensionRecord,
  games: readonly ServedGame[],
) {
  const served = suspension.seasonTeamId
    ? games.filter(
        (game) =>
          game.id !== suspension.gameId &&
          (game.homeId === suspension.seasonTeamId ||
            game.awayId === suspension.seasonTeamId) &&
          Date.parse(game.approvedAt) >= Date.parse(suspension.createdAt),
      ).length
    : 0;
  const total = suspension.games;
  const done = suspension.completed || served >= total;
  return {
    served: Math.min(served, total),
    total,
    left: done ? 0 : total - served,
    done,
  };
}
