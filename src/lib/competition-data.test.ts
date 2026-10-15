import { describe, expect, it, vi } from "vitest";
import { careerGames } from "./competition-data";
import { defaultBasketballRules } from "./sports/basketball";
import type { createClient } from "./supabase/server";
vi.mock("server-only", () => ({}));
const id = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  let sequence = 0;
  const events: {
    id: string;
    sequence: number;
    type: string;
    payload: object;
    clock_ms: null;
    occurred_at: string;
  }[] = [];
  const add = (type: string, payload: object) =>
    events.push({
      id: id("e", ++sequence),
      sequence,
      type,
      payload,
      clock_ms: null,
      occurred_at: "2026-10-23T16:00:00Z",
    });
  for (const [team, prefix] of [
    ["home", "1"],
    ["away", "2"],
  ] as const) {
    const players = Array.from({ length: 6 }, (_, i) => ({
      playerId: id(prefix, i + 1),
      name: `${team} ${i + 1}`,
      jersey: i + 1,
    }));
    add("roster", { team, players });
    for (const player of players)
      add("checkin", { team, playerId: player.playerId });
    add("starters", {
      team,
      playerIds: players.slice(0, 5).map((p) => p.playerId),
    });
  }
  add("period_start", {});
  add("score", { team: "home", playerId: id("1", 1), points: 2, made: true });
  for (let q = 1; q <= 4; q++) {
    add("period_end", {});
    if (q < 4) add("period_start", {});
  }
  add("game_end", {});
  return {
    id: id("c", 1),
    seasonId: id("a", 1),
    seasonName: "Cup",
    divisionId: id("b", 1),
    divisionName: "Open",
    sport: "basketball",
    rules: defaultBasketballRules,
    playedAt: null,
    homeName: "Home",
    awayName: "Away",
    homeScore: 2,
    awayScore: 0,
    events,
  };
}
describe("public approved career data", () => {
  it("rebuilds performances and sends explicit league, season and player scopes", async () => {
    const source = fixture();
    const rpc = vi.fn().mockResolvedValue({ data: [source], error: null });
    const result = await careerGames(
      { rpc } as unknown as Awaited<ReturnType<typeof createClient>>,
      id("d", 1),
      source.seasonId,
      id("1", 1),
    );
    expect(rpc).toHaveBeenCalledWith("career_games", {
      p_league_id: id("d", 1),
      p_season_id: source.seasonId,
      p_player_id: id("1", 1),
    });
    expect(result.unreadableGames).toBe(0);
    expect(result.games).toHaveLength(1);
    expect(result.games[0]).toMatchObject({
      name: "home 1",
      teamName: "Home",
      opponent: "Away",
      won: true,
      metrics: { points: 2 },
    });
  });
  it("does not count unused bench players as appearances", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [fixture()], error: null });
    const result = await careerGames(
      { rpc } as unknown as Awaited<ReturnType<typeof createClient>>,
      id("d", 1),
    );
    expect(result.games).toHaveLength(10);
    expect(result.games.some((game) => game.playerId === id("1", 6))).toBe(
      false,
    );
  });
  it.each(["invalidEvent", "wrongResult"])(
    "excludes an incomplete history: %s",
    async (problem) => {
      const source = fixture();
      if (problem === "invalidEvent") source.events[0].type = "unknown_action";
      else source.homeScore = 99;
      const rpc = vi.fn().mockResolvedValue({ data: [source], error: null });
      const result = await careerGames(
        { rpc } as unknown as Awaited<ReturnType<typeof createClient>>,
        id("d", 1),
      );
      expect(result).toEqual({ games: [], unreadableGames: 1 });
    },
  );
});
