import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveGame, correctResult, recordForfeit } from "./actions";
import { getLeagueAccess } from "@/lib/league-access";
import { loadGameRecord } from "@/lib/game-record";
import { getSportModule } from "@/lib/sports/registry";
vi.mock("@/lib/league-access", () => ({ getLeagueAccess: vi.fn() }));
vi.mock("@/lib/game-record", () => ({ loadGameRecord: vi.fn() }));
vi.mock("@/lib/sports/registry", () => ({ getSportModule: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const playerId = "10000000-0000-4000-8000-000000000001";
const gameId = "90000000-0000-4000-8000-000000000001";
const rpc = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getLeagueAccess).mockResolvedValue({
    supabase: { rpc },
    league: { id: "league-one" },
    canView: true,
    canManage: true,
  } as unknown as Awaited<ReturnType<typeof getLeagueAccess>>);
  vi.mocked(loadGameRecord).mockResolvedValue({
    game: { id: gameId, leagueId: "league-one", status: "submitted" },
    summary: {
      homeScore: 50,
      awayScore: 40,
      summary: { official: true },
      ejectedPlayers: [],
    },
    lastSequence: 41,
    unreadableEvents: 0,
    sport: "basketball",
    state: {},
  } as unknown as Awaited<ReturnType<typeof loadGameRecord>>);
  vi.mocked(getSportModule).mockReturnValue({
    playerOfGameCandidates: () => [
      { playerId, name: "Player", efficiency: 20, metrics: {}, side: "home" },
    ],
  } as unknown as ReturnType<typeof getSportModule>);
  rpc.mockResolvedValue({ error: null });
});
describe("game award approval action", () => {
  it("saves the chosen player with server-derived scores and sequence in one RPC", async () => {
    expect(
      await approveGame("sindikato", {
        gameId,
        suspend: [],
        playerOfGame: playerId,
      }),
    ).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("approve_game_with_player", {
      p_league_id: "league-one",
      p_game_id: gameId,
      p_last_sequence: 41,
      p_home_score: 50,
      p_away_score: 40,
      p_summary: { official: true },
      p_suspend_player_ids: [],
      p_suspend_games: [],
      p_player_id: playerId,
    });
  });
  it.each([null, "20000000-0000-4000-8000-000000000002"])(
    "rejects missing or ineligible selection %s",
    async (playerOfGame) => {
      expect(
        await approveGame("sindikato", { gameId, suspend: [], playerOfGame }),
      ).toEqual({ error: "invalidForm" });
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("does not let staff confirm the award", async () => {
    const access = await getLeagueAccess("sindikato");
    vi.mocked(getLeagueAccess).mockResolvedValue({
      ...access,
      canManage: false,
    });
    expect(
      await approveGame("sindikato", {
        gameId,
        suspend: [],
        playerOfGame: playerId,
      }),
    ).toEqual({ error: "notAllowed" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects a game from another league", async () => {
    const record = (await loadGameRecord({} as never, gameId))!;
    vi.mocked(loadGameRecord).mockResolvedValue({
      ...record,
      game: { ...record.game, leagueId: "other-league" },
    });
    expect(
      await approveGame("sindikato", {
        gameId,
        suspend: [],
        playerOfGame: playerId,
      }),
    ).toEqual({ error: "gameNotFound" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("forfeits and corrections", () => {
  it("records a no-show without needing the game's score", async () => {
    expect(
      await recordForfeit("sindikato", {
        gameId,
        kind: "forfeit",
        side: "away",
        reason: "Did not show up",
      }),
    ).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("record_forfeit", {
      p_league_id: "league-one",
      p_game_id: gameId,
      p_kind: "forfeit",
      p_side: "away",
      p_reason: "Did not show up",
      p_home_score: 0,
      p_away_score: 0,
    });
  });
  it("sends the score so far for a default", async () => {
    vi.mocked(getSportModule).mockReturnValue({
      liveScore: () => ({ homeScore: 31, awayScore: 36, status: { key: "x" } }),
    } as unknown as ReturnType<typeof getSportModule>);
    await recordForfeit("sindikato", {
      gameId,
      kind: "default",
      side: "home",
      reason: "Only one player left",
    });
    expect(rpc).toHaveBeenCalledWith(
      "record_forfeit",
      expect.objectContaining({ p_home_score: 31, p_away_score: 36 }),
    );
  });
  it("needs a reason, and refuses a double default", async () => {
    expect(
      await recordForfeit("sindikato", {
        gameId,
        kind: "forfeit",
        side: "home",
        reason: " ",
      }),
    ).toEqual({ error: "reasonRequired" });
    expect(
      await recordForfeit("sindikato", {
        gameId,
        kind: "default",
        side: "both",
        reason: "Both",
      }),
    ).toEqual({ error: "invalidForm" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("lets only the commissioner reopen a result", async () => {
    vi.mocked(getLeagueAccess).mockResolvedValue({
      supabase: { rpc },
      league: { id: "league-one" },
      canView: true,
      canManage: false,
    } as unknown as Awaited<ReturnType<typeof getLeagueAccess>>);
    expect(
      await correctResult("sindikato", { gameId, reason: "Wrong player" }),
    ).toEqual({ error: "commissionerOnly" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("explains a locked playoff result in plain words", async () => {
    rpc.mockResolvedValue({
      error: { message: "bracket_result_locked", code: "23514" },
    });
    expect(
      await correctResult("sindikato", { gameId, reason: "Wrong score" }),
    ).toEqual({ error: "bracketLocked" });
  });
});
