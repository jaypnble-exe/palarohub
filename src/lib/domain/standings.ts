/** A forfeit is a loss that earns no standings points (FIBA: 0 instead of 1). */
export type StandingsResult = "win" | "loss" | "draw" | "forfeit";

/** Sport-neutral tiebreakers, applied in the order a sport module lists them. */
export type Tiebreaker =
  /** Standings points in games between the tied teams only. */
  | "headToHeadPoints"
  /** Score difference in games between the tied teams only. */
  | "headToHeadDifference"
  /** Points scored in games between the tied teams only. */
  | "headToHeadScored"
  | "pointDifference"
  | "pointsScored";

export interface StandingsRules {
  points(result: StandingsResult): number;
  tiebreakers: readonly Tiebreaker[];
}

export interface StandingsTeam {
  id: string;
  name: string;
}

/** An approved result. */
export interface StandingsGame {
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  /** Set when the result was a forfeit: that team (or both) lost by not playing. */
  forfeitedBy?: "home" | "away" | "both" | null;
}

export interface StandingsRow {
  teamId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  difference: number;
  points: number;
  /** Shared by teams the tiebreakers could not separate. */
  rank: number;
  tied: boolean;
}

interface Tally {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
}

function tally(
  ids: ReadonlySet<string>,
  games: readonly StandingsGame[],
  rules: StandingsRules,
) {
  const totals = new Map<string, Tally>(
    [...ids].map((id) => [
      id,
      {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        points: 0,
      },
    ]),
  );
  for (const game of games) {
    const home = totals.get(game.homeId);
    const away = totals.get(game.awayId);
    if (!home || !away) continue;
    const outcome: [StandingsResult, StandingsResult] =
      game.forfeitedBy === "both"
        ? ["forfeit", "forfeit"]
        : game.forfeitedBy === "home"
          ? ["forfeit", "win"]
          : game.forfeitedBy === "away"
            ? ["win", "forfeit"]
            : game.homeScore > game.awayScore
              ? ["win", "loss"]
              : game.homeScore < game.awayScore
                ? ["loss", "win"]
                : ["draw", "draw"];
    for (const [line, scored, allowed, result] of [
      [home, game.homeScore, game.awayScore, outcome[0]],
      [away, game.awayScore, game.homeScore, outcome[1]],
    ] as const) {
      line.played++;
      line.pointsFor += scored;
      line.pointsAgainst += allowed;
      line.points += rules.points(result);
      if (result === "win") line.wins++;
      else if (result === "draw") line.draws++;
      else line.losses++;
    }
  }
  return totals;
}

/** Splits teams into groups with equal values, highest value first. */
function partition(teams: readonly string[], value: (id: string) => number) {
  const groups = new Map<number, string[]>();
  for (const id of teams)
    groups.set(value(id), [...(groups.get(value(id)) ?? []), id]);
  return [...groups.entries()].sort(([a], [b]) => b - a).map(([, ids]) => ids);
}

/**
 * Ranks a division from approved results. Teams are ordered by standings
 * points; tied teams are separated by the sport's tiebreakers. Whenever a
 * tiebreaker splits a group, each smaller tied group starts again from the
 * first tiebreaker using only its own games (FIBA style). Teams still level
 * after every tiebreaker share a rank and are marked as tied.
 */
export function computeStandings(
  teams: readonly StandingsTeam[],
  games: readonly StandingsGame[],
  rules: StandingsRules,
): StandingsRow[] {
  const ids = new Set(teams.map((team) => team.id));
  const names = new Map(teams.map((team) => [team.id, team.name]));
  const counted = games.filter(
    (game) =>
      game.homeId !== game.awayId &&
      ids.has(game.homeId) &&
      ids.has(game.awayId),
  );
  const overall = tally(ids, counted, rules);
  const byName = (a: string, b: string) =>
    (names.get(a) ?? "").localeCompare(names.get(b) ?? "") ||
    a.localeCompare(b);

  function rankGroup(group: string[]): { ids: string[]; tied: boolean }[] {
    if (group.length === 1) return [{ ids: group, tied: false }];
    const members = new Set(group);
    const among = tally(
      members,
      counted.filter(
        (game) => members.has(game.homeId) && members.has(game.awayId),
      ),
      rules,
    );
    const metric = (key: Tiebreaker, id: string) => {
      const head = among.get(id)!;
      const all = overall.get(id)!;
      switch (key) {
        case "headToHeadPoints":
          return head.points;
        case "headToHeadDifference":
          return head.pointsFor - head.pointsAgainst;
        case "headToHeadScored":
          return head.pointsFor;
        case "pointDifference":
          return all.pointsFor - all.pointsAgainst;
        case "pointsScored":
          return all.pointsFor;
      }
    };
    for (const key of rules.tiebreakers) {
      const split = partition(group, (id) => metric(key, id));
      if (split.length > 1) return split.flatMap(rankGroup);
    }
    return [{ ids: [...group].sort(byName), tied: true }];
  }

  const blocks = partition([...ids], (id) => overall.get(id)!.points).flatMap(
    (group) => rankGroup(group.sort(byName)),
  );
  const rows: StandingsRow[] = [];
  for (const block of blocks) {
    const rank = rows.length + 1;
    const played = block.ids.some((id) => overall.get(id)!.played > 0);
    for (const id of block.ids) {
      const line = overall.get(id)!;
      rows.push({
        teamId: id,
        name: names.get(id) ?? "",
        ...line,
        difference: line.pointsFor - line.pointsAgainst,
        rank,
        // Before any games every team is level; that is not a tie worth flagging.
        tied: block.tied && played,
      });
    }
  }
  return rows;
}
