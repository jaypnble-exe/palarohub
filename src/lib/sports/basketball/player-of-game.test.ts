import { describe, expect, it } from "vitest";
import { basketballPlayerOfGameCandidates } from "./player-of-game";
import { reduceBasketballGame } from "./reducer";
import { defaultBasketballRules } from "./rules";
import type { BasketballEvent } from "./events";

function fixture() {
  const events = ["home", "away"].map((team, index) => ({
    id: `e0000000-0000-4000-8000-00000000000${index + 1}`,
    sequence: index + 1,
    clockMs: null,
    createdAt: "2026-10-15T12:00:00Z",
    type: "roster",
    payload: {
      team,
      players: [1, 2, 3].map((n) => ({
        playerId: `${index + 1}0000000-0000-4000-8000-00000000000${n}`,
        name: `${team} ${n}`,
        jersey: n,
      })),
    },
  })) as BasketballEvent[];
  const state = reduceBasketballGame(events, defaultBasketballRules);
  state.phase = "final";
  state.winner = "home";
  for (const team of Object.values(state.teams))
    for (const player of Object.values(team.players)) player.entered = true;
  return state;
}

describe("Player of the Game suggestions", () => {
  it("subtracts missed shots and turnovers and ranks winning participants only", () => {
    const state = fixture();
    const [first, second, bench] = Object.values(state.teams.home.players);
    first.points = 20;
    first.stats = { rebound: 5, assist: 4, steal: 2, block: 1, turnover: 3 };
    first.twoPointers = { made: 5, attempted: 9 };
    first.threePointers = { made: 2, attempted: 5 };
    first.freeThrows = { made: 4, attempted: 6 };
    second.points = 21;
    bench.entered = false;
    bench.points = 100;
    Object.values(state.teams.away.players)[0].points = 200;
    const rows = basketballPlayerOfGameCandidates(state);
    expect(rows.map((row) => row.playerId)).toEqual([
      second.playerId,
      first.playerId,
    ]);
    expect(rows[1].efficiency).toBe(20);
  });
  it("preserves tied and negative efficiency candidates for commissioner review", () => {
    const state = fixture();
    Object.values(state.teams.home.players).forEach((player) => {
      player.stats.turnover = 2;
    });
    expect(
      basketballPlayerOfGameCandidates(state).map((row) => row.efficiency),
    ).toEqual([-2, -2, -2]);
  });
  it("does not suggest a player before the game ends or without a winner", () => {
    const state = fixture();
    state.phase = "live";
    expect(basketballPlayerOfGameCandidates(state)).toEqual([]);
    state.phase = "final";
    state.winner = null;
    expect(basketballPlayerOfGameCandidates(state)).toEqual([]);
  });
});
