import { describe, expect, it } from "vitest";
import {
  basketball,
  basketballEventSchema,
  basketballRulesSchema,
  boxScore,
  defaultBasketballRules,
  inPenalty,
  lastUndoableEvent,
  mustSubstitute,
  reduceBasketballGame,
  teamFoulsThisPeriod,
  timeoutsLeft,
  validateBasketballEvent,
  summarizeBasketballGame,
  scoresheetMarks,
  type BasketballEvent,
  type BasketballEventOf,
  type BasketballRules,
  type Side,
} from "./index";

const rules = defaultBasketballRules;
const uuid = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const home = Array.from({ length: 8 }, (_, i) => uuid("1", i + 1));
const away = Array.from({ length: 8 }, (_, i) => uuid("2", i + 1));
const [h1, h2, h3, , , h6] = home;
const [a1] = away;

/** Builds events with increasing sequence numbers, like a scorer device. */
function scorer() {
  let sequence = 0;
  const events: BasketballEvent[] = [];
  function add<T extends BasketballEvent["type"]>(
    type: T,
    payload: BasketballEventOf<T>["payload"],
    clockMs: number | null = null,
  ) {
    sequence++;
    const event = {
      id: uuid("e", sequence),
      sequence,
      clockMs,
      createdAt: new Date(Date.UTC(2026, 9, 23, 16, 0, sequence)).toISOString(),
      type,
      payload,
    } as BasketballEventOf<T>;
    events.push(event);
    return event;
  }
  const state = (custom: BasketballRules = rules) =>
    reduceBasketballGame(events, custom);
  return { add, events, state };
}

/** Rosters, everyone present, starting fives, and tip-off. */
function tipOff() {
  const game = scorer();
  for (const [team, ids] of [
    ["home", home],
    ["away", away],
  ] as const) {
    game.add("roster", {
      team,
      players: ids.map((playerId, i) => ({
        playerId,
        name: `${team} ${i + 1}`,
        jersey: i + 4,
      })),
    });
    for (const playerId of ids) game.add("checkin", { team, playerId });
    game.add("starters", { team, playerIds: ids.slice(0, 5) });
  }
  game.add("period_start", {});
  return game;
}
const foul = (
  game: ReturnType<typeof scorer>,
  team: Side,
  playerId: string | null,
  kind:
    "personal" | "technical" | "unsportsmanlike" | "disqualifying" = "personal",
) => game.add("foul", { team, playerId, kind });
const lastEntry = (game: ReturnType<typeof scorer>) => game.state().log.at(-1);

describe("basketball game setup", () => {
  it("starts the first quarter once both starting fives are set", () => {
    const game = tipOff();
    const state = game.state();
    expect(state.phase).toBe("live");
    expect(state.period).toBe(1);
    expect(state.clock).toMatchObject({ running: false, remainingMs: 600_000 });
    expect(state.teams.home.onCourt).toEqual(home.slice(0, 5));
    expect(state.log.every((entry) => entry.status === "applied")).toBe(true);
  });

  it("blocks tip-off without starters and starters who are not present", () => {
    const game = scorer();
    game.add("roster", {
      team: "home",
      players: home.map((playerId, i) => ({
        playerId,
        name: `H${i}`,
        jersey: i,
      })),
    });
    const notHere = game.add("starters", {
      team: "home",
      playerIds: home.slice(0, 5),
    });
    expect(
      game.state().log.find((entry) => entry.eventId === notHere.id)?.error,
    ).toBe("playerNotPresent");
    game.add("period_start", {});
    expect(lastEntry(game)).toMatchObject({
      status: "ignored",
      error: "startersMissing",
    });
    expect(game.state().phase).toBe("pregame");
  });

  it("requires exactly five different starters", () => {
    const game = tipOff();
    const state = reduceBasketballGame(game.events.slice(0, -1), rules);
    const starters = {
      id: uuid("f", 1),
      sequence: 99,
      clockMs: null,
      createdAt: "2026-10-23T16:00:00.000Z",
      type: "starters" as const,
      payload: { team: "home" as const, playerIds: [h1, h1, h2, h3, home[3]] },
    };
    expect(validateBasketballEvent(state, starters, rules)).toBe(
      "startersNotFive",
    );
  });

  it("changes a jersey for this game only when the number is free", () => {
    const game = tipOff();
    game.add("jersey", { team: "home", playerId: h1, number: 23 });
    game.add("jersey", { team: "home", playerId: h2, number: 23 });
    const state = game.state();
    expect(state.teams.home.players[h1].jersey).toBe(23);
    expect(state.teams.home.players[h2].jersey).toBe(5);
    expect(lastEntry(game)?.error).toBe("jerseyTaken");
  });

  it("keeps presence when the roster is refreshed before tip-off, never after", () => {
    const game = scorer();
    const roster = (ids: string[]) =>
      game.add("roster", {
        team: "home",
        players: ids.map((playerId, i) => ({
          playerId,
          name: `H${i}`,
          jersey: i,
        })),
      });
    roster(home.slice(0, 6));
    game.add("checkin", { team: "home", playerId: h1 });
    roster(home);
    expect(game.state().teams.home.players[h1].present).toBe(true);
    expect(game.state().teams.home.playerIds).toHaveLength(8);
    const started = tipOff();
    started.add("roster", { team: "home", players: [] });
    expect(lastEntry(started)?.error).toBe("notPregame");
  });

  it("lets late arrivals check in and come off the bench", () => {
    const game = scorer();
    game.add("roster", {
      team: "home",
      players: home.map((playerId, i) => ({
        playerId,
        name: `H${i}`,
        jersey: i,
      })),
    });
    game.add("roster", {
      team: "away",
      players: away.map((playerId, i) => ({
        playerId,
        name: `A${i}`,
        jersey: i,
      })),
    });
    for (const playerId of home.slice(0, 5))
      game.add("checkin", { team: "home", playerId });
    for (const playerId of away.slice(0, 5))
      game.add("checkin", { team: "away", playerId });
    game.add("starters", { team: "home", playerIds: home.slice(0, 5) });
    game.add("starters", { team: "away", playerIds: away.slice(0, 5) });
    game.add("period_start", {});
    game.add("substitution", { team: "home", out: h1, in: h6 });
    expect(lastEntry(game)?.error).toBe("playerNotPresent");
    game.add("checkin", { team: "home", playerId: h6 });
    game.add("substitution", { team: "home", out: h1, in: h6 });
    expect(game.state().teams.home.onCourt).toContain(h6);
  });
});

describe("basketball scoring", () => {
  it("adds made shots, counts misses, and flags made threes", () => {
    const game = tipOff();
    game.add("score", { team: "home", playerId: h1, points: 2, made: true });
    const three = game.add("score", {
      team: "home",
      playerId: h1,
      points: 3,
      made: true,
    });
    game.add("score", { team: "home", playerId: h1, points: 3, made: false });
    game.add("score", { team: "home", playerId: h1, points: 1, made: true });
    game.add("score", { team: "away", playerId: a1, points: 1, made: false });
    const state = game.state();
    expect(state.teams.home.score).toBe(6);
    expect(state.teams.away.score).toBe(0);
    expect(state.teams.home.pointsByPeriod).toEqual({ 1: 6 });
    expect(state.teams.home.players[h1]).toMatchObject({
      points: 6,
      twoPointers: { made: 1, attempted: 1 },
      threePointers: { made: 1, attempted: 2 },
      freeThrows: { made: 1, attempted: 1 },
    });
    expect(state.effects).toEqual([
      { eventId: three.id, kind: "madeThree", team: "home", playerId: h1 },
    ]);
  });

  it("refuses points for a player on the bench or before tip-off", () => {
    const game = tipOff();
    game.add("score", { team: "home", playerId: h6, points: 2, made: true });
    expect(lastEntry(game)?.error).toBe("playerNotOnCourt");
    const pregame = scorer();
    pregame.add("roster", {
      team: "home",
      players: [{ playerId: h1, name: "H1", jersey: 4 }],
    });
    pregame.add("checkin", { team: "home", playerId: h1 });
    pregame.add("score", { team: "home", playerId: h1, points: 2, made: true });
    expect(lastEntry(pregame)?.error).toBe("notLive");
    expect(game.state().teams.home.score).toBe(0);
  });
});

describe("basketball fouls", () => {
  it("warns on the 4th foul and fouls a player out on the 5th", () => {
    const game = tipOff();
    for (let i = 0; i < 3; i++) foul(game, "home", h1);
    const fourth = foul(game, "home", h1);
    const fifth = foul(game, "home", h1);
    const state = game.state();
    expect(state.effects).toContainEqual({
      eventId: fourth.id,
      kind: "foulWarning",
      team: "home",
      playerId: h1,
    });
    expect(state.effects).toContainEqual({
      eventId: fifth.id,
      kind: "fouledOut",
      team: "home",
      playerId: h1,
    });
    expect(state.teams.home.players[h1].disqualified).toBe("fouledOut");
    expect(mustSubstitute(state, "home")).toEqual([h1]);
    game.add("score", { team: "home", playerId: h1, points: 2, made: true });
    expect(lastEntry(game)?.error).toBe("playerDisqualified");
    game.add("substitution", { team: "home", out: h1, in: h6 });
    game.add("substitution", { team: "home", out: h6, in: h1 });
    expect(lastEntry(game)?.error).toBe("playerDisqualified");
    expect(mustSubstitute(game.state(), "home")).toEqual([]);
  });

  it("uses the league's foul-out limit", () => {
    const game = tipOff();
    for (let i = 0; i < 5; i++) foul(game, "home", h1);
    const custom = basketballRulesSchema.parse({ foulOut: 6 });
    expect(game.state(custom).teams.home.players[h1].disqualified).toBeNull();
    foul(game, "home", h1);
    expect(game.state(custom).teams.home.players[h1].disqualified).toBe(
      "fouledOut",
    );
  });

  it.each([
    [["technical", "technical"]],
    [["technical", "unsportsmanlike"]],
    [["unsportsmanlike", "unsportsmanlike"]],
    [["disqualifying"]],
  ] as const)("ejects a player after %j", (kinds) => {
    const game = tipOff();
    for (const kind of kinds) foul(game, "home", h1, kind);
    const state = game.state();
    expect(state.teams.home.players[h1].disqualified).toBe("ejected");
    expect(state.effects.at(-1)?.kind).toBe("ejected");
  });

  it("puts a team in the penalty on its 4th team foul of the quarter", () => {
    const game = tipOff();
    for (const id of [h1, h2, h3]) foul(game, "home", id);
    expect(inPenalty(game.state(), "home", rules)).toBe(false);
    const fourth = foul(game, "home", home[3]);
    const state = game.state();
    expect(teamFoulsThisPeriod(state, "home", rules)).toBe(4);
    expect(inPenalty(state, "home", rules)).toBe(true);
    expect(inPenalty(state, "away", rules)).toBe(false);
    expect(state.effects).toContainEqual({
      eventId: fourth.id,
      kind: "teamPenalty",
      team: "home",
      playerId: null,
    });
    game.add("period_end", {});
    game.add("period_start", {});
    expect(teamFoulsThisPeriod(game.state(), "home", rules)).toBe(0);
  });

  it("charges coach technicals to the team without team fouls", () => {
    const game = tipOff();
    foul(game, "home", null, "technical");
    expect(game.state().teams.home.benchTechnicals).toBe(1);
    expect(teamFoulsThisPeriod(game.state(), "home", rules)).toBe(0);
    const second = foul(game, "home", null, "technical");
    const state = game.state();
    expect(state.teams.home.coachEjected).toBe(true);
    expect(state.effects).toContainEqual({
      eventId: second.id,
      kind: "coachEjected",
      team: "home",
      playerId: null,
    });
  });

  it("allows technicals on the bench and during breaks, personals only on court", () => {
    const game = tipOff();
    foul(game, "home", h6);
    expect(lastEntry(game)?.error).toBe("playerNotOnCourt");
    foul(game, "home", h6, "technical");
    expect(lastEntry(game)?.status).toBe("applied");
    game.add("period_end", {});
    foul(game, "home", h1, "technical");
    const state = game.state();
    expect(state.teams.home.players[h1].fouls.technical).toBe(1);
    expect(teamFoulsThisPeriod(state, "home", rules)).toBe(1);
  });
});

describe("basketball substitutions and timeouts", () => {
  it("swaps one player for another and keeps five on court", () => {
    const game = tipOff();
    const sub = game.add("substitution", { team: "home", out: h2, in: h6 });
    const state = game.state();
    expect(state.teams.home.onCourt).toEqual([h1, h6, h3, home[3], home[4]]);
    expect(state.effects.at(-1)).toEqual({
      eventId: sub.id,
      kind: "substitution",
      team: "home",
      playerId: h6,
    });
    game.add("substitution", { team: "home", out: h6, in: h1 });
    expect(lastEntry(game)?.error).toBe("playerAlreadyOnCourt");
    game.add("substitution", { team: "home", out: h2, in: home[6] });
    expect(lastEntry(game)?.error).toBe("playerNotOnCourt");
  });

  it("counts timeouts per half and per overtime", () => {
    const game = tipOff();
    game.add("timeout", { team: "home" });
    game.add("timeout", { team: "home" });
    expect(timeoutsLeft(game.state(), "home", rules)).toBe(0);
    expect(timeoutsLeft(game.state(), "away", rules)).toBe(2);
    game.add("timeout", { team: "home" });
    expect(lastEntry(game)?.error).toBe("noTimeoutsLeft");
    game.add("period_end", {});
    game.add("period_start", {});
    expect(timeoutsLeft(game.state(), "home", rules)).toBe(0);
    game.add("period_end", {});
    game.add("period_start", {});
    expect(game.state().period).toBe(3);
    expect(timeoutsLeft(game.state(), "home", rules)).toBe(3);
  });

  it("stops the running clock for timeouts and fouls", () => {
    const game = tipOff();
    game.add("clock_start", {}, 600_000);
    game.add("timeout", { team: "away" }, 590_000);
    expect(game.state().clock).toMatchObject({
      running: false,
      remainingMs: 590_000,
    });
    game.add("clock_start", {}, 590_000);
    foul(game, "home", h1);
    expect(game.state().clock.running).toBe(false);
    game.add("clock_stop", {});
    expect(lastEntry(game)?.error).toBe("clockStopped");
  });
});

describe("basketball clock and minutes", () => {
  it("credits running game time to the players on court", () => {
    const game = tipOff();
    game.add("clock_start", {}, 600_000);
    game.add("clock_stop", {}, 540_000);
    game.add("substitution", { team: "home", out: h1, in: h6 }, 540_000);
    game.add("clock_start", {}, 540_000);
    game.add("period_end", {});
    const state = game.state();
    expect(state.teams.home.players[h1].playedMs).toBe(60_000);
    expect(state.teams.home.players[h6].playedMs).toBe(540_000);
    expect(state.teams.home.players[h2].playedMs).toBe(600_000);
    expect(state.teams.home.players[home[7]].playedMs).toBe(0);
    expect(
      boxScore(state, "home").rows.find((row) => row.playerId === h2)?.minutes,
    ).toBe(10);
  });

  it("does not credit time while the clock is stopped", () => {
    const game = tipOff();
    game.add(
      "score",
      { team: "home", playerId: h1, points: 2, made: true },
      500_000,
    );
    expect(game.state().teams.home.players[h1].playedMs).toBe(0);
    expect(game.state().clock.remainingMs).toBe(500_000);
  });
});

describe("basketball periods and the final buzzer", () => {
  it("goes to overtime on a tie and shares 4th-quarter team fouls", () => {
    const game = tipOff();
    game.add("period_end", {});
    for (let period = 2; period <= 4; period++) {
      game.add("period_start", {});
      if (period === 4) for (const id of [h1, h2, h3]) foul(game, "home", id);
      game.add("period_end", {});
    }
    game.add("game_end", {});
    expect(lastEntry(game)?.error).toBe("scoreTied");
    game.add("period_start", {});
    const state = game.state();
    expect(state.period).toBe(5);
    expect(state.clock.remainingMs).toBe(300_000);
    expect(teamFoulsThisPeriod(state, "home", rules)).toBe(3);
    expect(timeoutsLeft(state, "home", rules)).toBe(1);
  });

  it("ends the game only after regulation with a winner", () => {
    const game = tipOff();
    game.add("score", { team: "away", playerId: a1, points: 2, made: true });
    game.add("period_end", {});
    game.add("game_end", {});
    expect(lastEntry(game)?.error).toBe("regulationNotOver");
    game.events.pop();
    for (let period = 2; period <= 4; period++) {
      game.add("period_start", {});
      if (period === 2) {
        game.add("game_end", {});
        expect(lastEntry(game)?.error).toBe("periodInProgress");
      }
      game.add("period_end", {});
    }
    game.add("period_start", {});
    expect(lastEntry(game)?.error).toBe("regulationOver");
    game.add("game_end", {});
    const state = game.state();
    expect(state.phase).toBe("final");
    expect(state.winner).toBe("away");
    expect(state.effects.at(-1)?.kind).toBe("gameEnd");
    game.add("score", { team: "home", playerId: h1, points: 2, made: true });
    expect(lastEntry(game)?.error).toBe("gameOver");
  });
});

describe("basketball corrections", () => {
  it("voids an earlier event without deleting it", () => {
    const game = tipOff();
    const basket = game.add("score", {
      team: "home",
      playerId: h1,
      points: 3,
      made: true,
    });
    game.add("void", { eventId: basket.id });
    const state = game.state();
    expect(state.teams.home.score).toBe(0);
    expect(state.effects).toEqual([]);
    expect(state.log.find((entry) => entry.eventId === basket.id)?.status).toBe(
      "voided",
    );
    expect(state.log.at(-1)?.status).toBe("void");
    expect(game.events).toHaveLength(state.log.length);
  });

  it("re-checks later events when an earlier one is corrected", () => {
    const game = tipOff();
    const sub = game.add("substitution", { team: "home", out: h1, in: h6 });
    const basket = game.add("score", {
      team: "home",
      playerId: h6,
      points: 2,
      made: true,
    });
    game.add("void", { eventId: sub.id });
    const state = game.state();
    expect(
      state.log.find((entry) => entry.eventId === basket.id),
    ).toMatchObject({
      status: "ignored",
      error: "playerNotOnCourt",
    });
    expect(state.teams.home.score).toBe(0);
  });

  it("refuses to void a void, a missing event, or the same event twice", () => {
    const game = tipOff();
    const basket = game.add("score", {
      team: "home",
      playerId: h1,
      points: 2,
      made: true,
    });
    const undo = game.add("void", { eventId: basket.id });
    game.add("void", { eventId: undo.id });
    expect(lastEntry(game)?.error).toBe("voidTargetInvalid");
    game.add("void", { eventId: basket.id });
    expect(lastEntry(game)?.error).toBe("voidTargetInvalid");
    game.add("void", { eventId: uuid("9", 1) });
    expect(lastEntry(game)?.error).toBe("voidTargetMissing");
    const state = game.state();
    const next = {
      ...undo,
      id: uuid("f", 3),
      sequence: state.lastSequence + 1,
    };
    expect(validateBasketballEvent(state, next, rules)).toBe(
      "voidTargetInvalid",
    );
    expect(game.state().teams.home.score).toBe(0);
  });

  it("finds the last action for Undo", () => {
    const game = tipOff();
    const first = game.add("score", {
      team: "home",
      playerId: h1,
      points: 2,
      made: true,
    });
    const second = game.add("timeout", { team: "away" });
    expect(lastUndoableEvent(game.state())?.eventId).toBe(second.id);
    game.add("void", { eventId: second.id });
    expect(lastUndoableEvent(game.state())?.eventId).toBe(first.id);
  });

  it("is idempotent for retried events and independent of arrival order", () => {
    const game = tipOff();
    game.add("score", { team: "home", playerId: h1, points: 2, made: true });
    game.add("score", { team: "away", playerId: a1, points: 3, made: true });
    const shuffled = [...game.events].reverse();
    const retried = [...game.events, game.events.at(-1)!, game.events[3]];
    const expected = game.state();
    expect(reduceBasketballGame(shuffled, rules)).toEqual(expected);
    expect(reduceBasketballGame(retried, rules)).toEqual(expected);
    expect(validateBasketballEvent(expected, game.events[3], rules)).toBe(
      "duplicateEvent",
    );
    expect(
      validateBasketballEvent(
        expected,
        { ...game.events[3], id: uuid("f", 4) },
        rules,
      ),
    ).toBe("outOfOrder");
  });

  it("does not modify the events it is given", () => {
    const game = tipOff();
    game.add("score", { team: "home", playerId: h1, points: 2, made: true });
    const copy = structuredClone(game.events);
    game.state();
    expect(game.events).toEqual(copy);
  });
});

describe("basketball box score and event parsing", () => {
  it("totals present players in roster order", () => {
    const game = tipOff();
    game.add("score", { team: "home", playerId: h1, points: 3, made: true });
    game.add("score", { team: "home", playerId: h2, points: 2, made: false });
    game.add("stat", { team: "home", playerId: h2, kind: "rebound" });
    foul(game, "home", h3);
    const { rows, totals } = boxScore(game.state(), "home");
    expect(rows.map((row) => row.playerId)).toEqual(home);
    expect(rows[0]).toMatchObject({ jersey: 4, starter: true, points: 3 });
    expect(totals).toMatchObject({
      points: 3,
      fieldGoals: { made: 1, attempted: 2 },
      threePointers: { made: 1, attempted: 1 },
      fouls: 1,
      stats: { rebound: 1, assist: 0 },
    });
  });

  it("parses stored events strictly", () => {
    const base = {
      id: uuid("e", 1),
      sequence: 1,
      clockMs: null,
      createdAt: "2026-10-23T16:00:00.000Z",
    };
    const parse = (type: string, payload: unknown) =>
      basketballEventSchema.safeParse({ ...base, type, payload }).success;
    expect(
      parse("foul", { team: "home", playerId: null, kind: "technical" }),
    ).toBe(true);
    expect(
      parse("foul", { team: "home", playerId: null, kind: "personal" }),
    ).toBe(false);
    expect(
      parse("score", { team: "home", playerId: h1, points: 4, made: true }),
    ).toBe(false);
    expect(parse("substitution", { team: "home", out: h1, in: h1 })).toBe(
      false,
    );
    expect(parse("timeout", { team: "home", reason: "x" })).toBe(false);
    expect(parse("shot_clock", {})).toBe(false);
    expect(
      basketball.eventSchema.safeParse({
        ...base,
        type: "period_start",
        payload: {},
      }).success,
    ).toBe(true);
  });
});

describe("basketball official summary", () => {
  it("is empty until the final buzzer, then records the result", () => {
    const game = tipOff();
    const names = { home: "Royals", away: "Hawks" };
    game.add("score", { team: "home", playerId: h1, points: 3, made: true });
    for (let i = 0; i < 2; i++) foul(game, "home", h2, "technical");
    for (let i = 0; i < 5; i++) foul(game, "away", a1);
    expect(summarizeBasketballGame(game.state(), names)).toBeNull();
    game.add("period_end", {});
    for (let period = 2; period <= 4; period++) {
      game.add("period_start", {});
      game.add("period_end", {});
    }
    game.add("game_end", {});
    const result = summarizeBasketballGame(game.state(), names);
    expect(result).toMatchObject({
      homeScore: 3,
      awayScore: 0,
      summary: { sport: "basketball", winner: "home", periods: 4 },
    });
    // Ejections are offered as suspensions; fouling out is not.
    expect(result?.ejectedPlayers).toEqual([
      { playerId: h2, name: "home 2", jersey: 5, team: "home" },
    ]);
    expect(JSON.parse(JSON.stringify(result?.summary))).toEqual(
      result?.summary,
    );
  });
});

describe("basketball scoresheet marks", () => {
  it("lists counted fouls in order and the running score by period", () => {
    const game = tipOff();
    game.add("score", { team: "home", playerId: h1, points: 2, made: true });
    const miss = game.add("score", {
      team: "home",
      playerId: h2,
      points: 3,
      made: true,
    });
    game.add("void", { eventId: miss.id });
    foul(game, "home", h1);
    game.add("period_end", {});
    game.add("period_start", {});
    game.add("score", { team: "home", playerId: h2, points: 3, made: true });
    foul(game, "home", h1, "technical");
    const { fouls, running } = scoresheetMarks(game.state(), game.events);
    expect(fouls.home[h1]).toEqual([
      { kind: "personal", period: 1 },
      { kind: "technical", period: 2 },
    ]);
    expect(running.home).toEqual([
      { total: 2, points: 2, jersey: 4, period: 1 },
      { total: 5, points: 3, jersey: 5, period: 2 },
    ]);
    expect(running.away).toEqual([]);
  });
});
