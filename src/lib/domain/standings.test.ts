import { describe, expect, it } from "vitest";
import {
  computeStandings,
  type StandingsGame,
  type StandingsRules,
} from "./standings";

// FIBA-style: win 2, loss 1.
const rules: StandingsRules = {
  points: (result) => (result === "win" ? 2 : 1),
  tiebreakers: [
    "headToHeadPoints",
    "headToHeadDifference",
    "headToHeadScored",
    "pointDifference",
    "pointsScored",
  ],
};
const teams = ["A", "B", "C", "D"].map((name) => ({
  id: name.toLowerCase(),
  name,
}));
const game = (
  homeId: string,
  homeScore: number,
  awayScore: number,
  awayId: string,
): StandingsGame => ({
  homeId,
  awayId,
  homeScore,
  awayScore,
});
const order = (rows: ReturnType<typeof computeStandings>) =>
  rows.map((row) => `${row.rank}${row.tied ? "=" : ""} ${row.name}`);

describe("standings", () => {
  it("lists every team, alphabetically and untied, before any game", () => {
    const rows = computeStandings(teams, [], rules);
    expect(order(rows)).toEqual(["1 A", "1 B", "1 C", "1 D"]);
    expect(rows[0]).toMatchObject({ played: 0, points: 0, difference: 0 });
  });

  it("counts wins, losses, scores, and standings points", () => {
    const rows = computeStandings(
      teams,
      [game("a", 70, 60, "b"), game("c", 50, 55, "a"), game("b", 80, 40, "d")],
      rules,
    );
    expect(rows[0]).toMatchObject({
      name: "A",
      played: 2,
      wins: 2,
      losses: 0,
      pointsFor: 125,
      pointsAgainst: 110,
      difference: 15,
      points: 4,
      rank: 1,
    });
    expect(rows.find((row) => row.name === "D")).toMatchObject({
      played: 1,
      losses: 1,
      points: 1,
    });
    expect(order(rows)).toEqual(["1 A", "2 B", "3 C", "4 D"]);
  });

  it("breaks a two-team tie by the game between them", () => {
    // Everyone has played twice; B and C are both 1-1 and C beat B.
    const rows = computeStandings(
      teams,
      [
        game("b", 60, 50, "d"),
        game("c", 61, 60, "b"),
        game("a", 90, 40, "c"),
        game("a", 70, 50, "d"),
      ],
      rules,
    );
    expect(rows.map((row) => row.points)).toEqual([4, 3, 3, 2]);
    expect(order(rows)).toEqual(["1 A", "2 C", "3 B", "4 D"]);
  });

  it("uses head-to-head difference for a three-way circle, then re-applies to the rest", () => {
    // A, B, C each 1-1 among themselves. A +15, B and C both -... then B beat C.
    const rows = computeStandings(
      teams.slice(0, 3),
      [game("a", 80, 60, "b"), game("b", 70, 65, "c"), game("c", 75, 70, "a")],
      rules,
    );
    // Head-to-head differences: A +15, B -15, C 0.
    expect(order(rows)).toEqual(["1 A", "2 C", "3 B"]);
  });

  it("restarts from head-to-head for a smaller tied group", () => {
    // A, B, C each go 1-1 among themselves and beat D: all on 5 points.
    // Head-to-head difference: A +8, B -4, C -4, so A is first. B and C then
    // start again with only their own game, which B won, even though C scored
    // more across the three-team games (continuing would wrongly favour C).
    const rows = computeStandings(
      teams,
      [
        game("a", 110, 100, "b"),
        game("b", 66, 60, "c"),
        game("c", 120, 118, "a"),
        game("a", 50, 40, "d"),
        game("b", 50, 40, "d"),
        game("c", 50, 40, "d"),
      ],
      rules,
    );
    expect(rows.slice(0, 3).map((row) => row.points)).toEqual([5, 5, 5]);
    expect(order(rows)).toEqual(["1 A", "2 B", "3 C", "4 D"]);
  });

  it("marks teams the tiebreakers cannot separate and lets them share a rank", () => {
    const rows = computeStandings(
      teams,
      [game("a", 60, 50, "c"), game("b", 60, 50, "d")],
      rules,
    );
    expect(order(rows)).toEqual(["1= A", "1= B", "3= C", "3= D"]);
  });

  it("ignores games involving teams outside the division", () => {
    const rows = computeStandings(
      teams.slice(0, 2),
      [game("a", 60, 50, "x"), game("x", 60, 50, "b"), game("a", 10, 10, "a")],
      rules,
    );
    expect(rows.every((row) => row.played === 0)).toBe(true);
  });

  it("counts draws for sports that allow them", () => {
    const rows = computeStandings(teams.slice(0, 2), [game("a", 1, 1, "b")], {
      points: (result) => (result === "win" ? 3 : result === "draw" ? 1 : 0),
      tiebreakers: [],
    });
    expect(rows.map((row) => [row.draws, row.points, row.tied])).toEqual([
      [1, 1, true],
      [1, 1, true],
    ]);
  });
});
