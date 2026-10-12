import { describe, expect, it, vi } from "vitest";
import { seasonStandings } from "./standings-data";

vi.mock("server-only", () => ({}));

const divisions = [
  { id: "div-b", name: "Division B", sport: "basketball" },
  { id: "div-a", name: "Division A", sport: "basketball" },
];
const tables: Record<string, unknown[]> = {
  published_season_teams: [
    { id: "royals", division_id: "div-b", team_name: "Royals" },
    { id: "hawks", division_id: "div-b", team_name: "Hawks" },
    { id: "titans", division_id: "div-b", team_name: "Titans" },
    { id: "aces", division_id: "div-a", team_name: "Aces" },
  ],
  published_games: [
    {
      division_id: "div-b",
      home_season_team_id: "royals",
      away_season_team_id: "hawks",
      home_score: 70,
      away_score: 60,
    },
    {
      division_id: "div-b",
      home_season_team_id: "hawks",
      away_season_team_id: "titans",
      home_score: 55,
      away_score: 50,
    },
    // An approved game without a stored score is not counted.
    {
      division_id: "div-b",
      home_season_team_id: "titans",
      away_season_team_id: "royals",
      home_score: null,
      away_score: null,
    },
  ],
};

/** Minimal stand-in for the Supabase query builder used by seasonStandings. */
function fakeClient() {
  const calls: { table: string; filters: [string, unknown][] }[] = [];
  return {
    calls,
    from(table: string) {
      const call = { table, filters: [] as [string, unknown][] };
      calls.push(call);
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          call.filters.push([column, value]);
          return builder;
        },
        then: (resolve: (value: unknown) => void) =>
          resolve({ data: tables[table], error: null }),
      };
      return builder;
    },
  };
}

describe("season standings data", () => {
  it("ranks each division from approved, scored games only", async () => {
    const client = fakeClient();
    const result = await seasonStandings(
      client as never,
      "league-1",
      "season-1",
      divisions,
    );
    expect(result.map((division) => division.divisionName)).toEqual([
      "Division A",
      "Division B",
    ]);
    const divisionB = result[1];
    expect(divisionB.gamesCounted).toBe(2);
    expect(divisionB.rows.map((row) => [row.name, row.points])).toEqual([
      ["Hawks", 3],
      ["Royals", 2],
      ["Titans", 1],
    ]);
    expect(result[0].rows).toMatchObject([{ name: "Aces", played: 0 }]);
    expect(
      client.calls.find((call) => call.table === "published_games")?.filters,
    ).toContainEqual(["status", "approved"]);
  });
});
