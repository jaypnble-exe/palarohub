import { describe, expect, it } from "vitest";
import {
  aggregateCareer,
  careerMetricValue,
  statisticalLeaders,
  type PlayerGame,
} from "./career-stats";
const game = (
  id: string,
  playerId = "p1",
  metrics = { points: 10, fieldGoals: 2, attempts: 4 },
): PlayerGame => ({
  gameId: id,
  playerId,
  name: playerId,
  metrics,
  seasonId: "season",
  seasonName: "Cup",
  divisionId: "d",
  divisionName: "Open",
  teamName: "Home",
  opponent: "Away",
  sport: "basketball",
  playedAt: null,
  won: true,
});
describe("player careers", () => {
  it("combines seasons and divisions without counting a repeated game twice", () => {
    const one = game("g1");
    const rows = aggregateCareer([
      one,
      one,
      { ...game("g2"), seasonId: "season2", divisionId: "d2" },
    ]);
    expect(rows[0]).toMatchObject({
      games: 2,
      wins: 2,
      metrics: { points: 20 },
    });
    expect(
      careerMetricValue(rows[0], { key: "points", labelKey: "points" }),
    ).toBe(10);
  });
  it("uses total attempts for shooting accuracy rather than averaging percentages", () => {
    const row = aggregateCareer([
      game("g1"),
      game("g2", "p1", { points: 6, fieldGoals: 3, attempts: 3 }),
    ])[0];
    expect(
      careerMetricValue(row, {
        key: "fieldGoals",
        labelKey: "accuracy",
        denominator: "attempts",
      }),
    ).toBeCloseTo(500 / 7);
    expect(
      careerMetricValue(
        { ...row, metrics: {} },
        { key: "made", labelKey: "accuracy", denominator: "attempts" },
      ),
    ).toBeNull();
  });
  it("shares statistical awards, omits zero awards, and keeps players separate", () => {
    const rows = aggregateCareer([game("g1"), game("g1", "p2")]);
    expect(
      statisticalLeaders(rows, "points").map((row) => row.playerId),
    ).toEqual(["p1", "p2"]);
    expect(statisticalLeaders(rows, "blocks")).toEqual([]);
    expect(statisticalLeaders([], "points")).toEqual([]);
  });
});
