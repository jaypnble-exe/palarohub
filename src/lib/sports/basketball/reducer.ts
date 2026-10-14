import type { BasketballRules } from "./rules";
import {
  foulKinds,
  sides,
  statKinds,
  type BasketballEvent,
  type BasketballEventOf,
  type BenchOffender,
  type ConfirmationRole,
  type FoulKind,
  type Side,
  type StatKind,
} from "./events";

export type Phase = "pregame" | "live" | "break" | "final";
export type Disqualification = "fouledOut" | "ejected";

export interface ShotLine {
  made: number;
  attempted: number;
}

export interface PlayerLine {
  playerId: string;
  name: string;
  jersey: number;
  present: boolean;
  starter: boolean;
  points: number;
  freeThrows: ShotLine;
  twoPointers: ShotLine;
  threePointers: ShotLine;
  fouls: Record<FoulKind, number>;
  foulCount: number;
  disqualified: Disqualification | null;
  stats: Record<StatKind, number>;
  playedMs: number;
  /** Has played in this game: a starter, or came in as a substitute. */
  entered: boolean;
}

export interface TeamState {
  /** Roster order from the snapshot. */
  playerIds: string[];
  players: Record<string, PlayerLine>;
  onCourt: string[];
  startersSet: boolean;
  score: number;
  pointsByPeriod: Record<number, number>;
  /** Keyed by foul period: overtime counts with the last quarter. */
  teamFouls: Record<number, number>;
  benchTechnicals: number;
  /** Technical fouls charged to the head coach (C) and to the bench (B). */
  coachFouls: Record<BenchOffender, number>;
  coachEjected: boolean;
  timeoutsUsed: Record<string, number>;
  /** Each timeout's period and the game clock left, for the scoresheet. */
  timeouts: { period: number; clockMs: number }[];
  coach: string | null;
  assistantCoach: string | null;
  captainId: string | null;
  shotClockViolations: number;
}

export type EffectKind =
  | "madeThree"
  | "foulWarning"
  | "fouledOut"
  | "ejected"
  | "coachEjected"
  | "teamPenalty"
  | "timeout"
  | "substitution"
  | "periodEnd"
  | "gameEnd"
  | "shotClockViolation"
  | "openingTip"
  | "jumpBall"
  | "periodPossession";

/** Moments worth an alert on the scorer screen or a flash on the TV. */
export interface Effect {
  eventId: string;
  kind: EffectKind;
  team: Side | null;
  playerId: string | null;
}

export type EventStatus = "applied" | "voided" | "ignored" | "void";
export interface LogEntry {
  eventId: string;
  sequence: number;
  type: BasketballEvent["type"];
  status: EventStatus;
  error: BasketballEventError | null;
}

export interface BasketballGameState {
  phase: Phase;
  /** 0 before tip-off; quarters first, then overtimes. */
  period: number;
  clock: { running: boolean; remainingMs: number; asOf: string | null };
  teams: Record<Side, TeamState>;
  possession: Side | null;
  /** Team controlling the ball; independent of the alternating-possession arrow. */
  ballControl: Side | null;
  officials: {
    referees: string[];
    scorer: string | null;
    timekeeper: string | null;
    shotClockOperator?: string | null;
  } | null;
  /** Runs and stops with the game clock; reset by recorded possession changes. */
  shotClock: { remainingMs: number };
  /** Free throws the next shooting team still has to take. */
  freeThrowsDue: { team: Side; count: number } | null;
  confirmations: { role: ConfirmationRole; name: string; at: string }[];
  protests: { team: Side; note: string; at: string }[];
  /** When the first period started and the final buzzer went (device time). */
  startedAt: string | null;
  endedAt: string | null;
  winner: Side | null;
  lastSequence: number;
  log: LogEntry[];
  effects: Effect[];
}

export type BasketballEventError =
  | "duplicateEvent"
  | "outOfOrder"
  | "gameOver"
  | "notPregame"
  | "notLive"
  | "periodInProgress"
  | "regulationNotOver"
  | "regulationOver"
  | "scoreTied"
  | "startersMissing"
  | "startersNotFive"
  | "unknownPlayer"
  | "playerNotPresent"
  | "alreadyPresent"
  | "playerNotOnCourt"
  | "playerAlreadyOnCourt"
  | "playerDisqualified"
  | "jerseyTaken"
  | "noTimeoutsLeft"
  | "clockRunning"
  | "clockStopped"
  | "voidTargetMissing"
  | "voidTargetInvalid"
  | "notFinal"
  | "arrowAlreadySet"
  | "arrowNotSet"
  | "notArrowTeam";

const zeroes = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

function emptyTeam(): TeamState {
  return {
    playerIds: [],
    players: {},
    onCourt: [],
    startersSet: false,
    score: 0,
    pointsByPeriod: {},
    teamFouls: {},
    benchTechnicals: 0,
    coachFouls: { coach: 0, bench: 0 },
    coachEjected: false,
    timeoutsUsed: {},
    timeouts: [],
    coach: null,
    assistantCoach: null,
    captainId: null,
    shotClockViolations: 0,
  };
}

export function initialBasketballState(): BasketballGameState {
  return {
    phase: "pregame",
    period: 0,
    clock: { running: false, remainingMs: 0, asOf: null },
    teams: { home: emptyTeam(), away: emptyTeam() },
    possession: null,
    ballControl: null,
    officials: null,
    shotClock: { remainingMs: 0 },
    freeThrowsDue: null,
    confirmations: [],
    protests: [],
    startedAt: null,
    endedAt: null,
    winner: null,
    lastSequence: 0,
    log: [],
    effects: [],
  };
}

/** Full shot clock in milliseconds, or 0 when the league plays without one. */
export function shotClockMs(rules: BasketballRules) {
  return rules.shotClock.seconds * 1000;
}

/**
 * Free throws a foul usually gives, as the scorer would write it: 1 for a
 * technical, 2 for unsportsmanlike or disqualifying, 2 for a personal foul
 * once the team is in the penalty, otherwise none. Shooting fouls are chosen
 * by the scorer (P1, P2, P3).
 */
export function automaticFreeThrows(
  state: BasketballGameState,
  side: Side,
  kind: FoulKind,
  rules: BasketballRules,
) {
  if (kind === "technical") return 1;
  if (kind === "unsportsmanlike" || kind === "disqualifying") return 2;
  if (kind === "personal") return inPenalty(state, side, rules) ? 2 : 0;
  return 0;
}

export function periodLengthMs(period: number, rules: BasketballRules) {
  return (
    (period <= rules.quarters ? rules.quarterMinutes : rules.overtimeMinutes) *
    60_000
  );
}

/** Overtime periods share the team-foul count of the last quarter. */
export function foulPeriod(period: number, rules: BasketballRules) {
  return Math.min(Math.max(period, 1), rules.quarters);
}

/** Which timeout allowance a period draws from. */
export function timeoutGroup(period: number, rules: BasketballRules) {
  if (period <= Math.ceil(rules.quarters / 2)) return "firstHalf";
  if (period <= rules.quarters) return "secondHalf";
  return `overtime-${period}`;
}

export function timeoutsLeft(
  state: BasketballGameState,
  side: Side,
  rules: BasketballRules,
) {
  const group = timeoutGroup(state.period, rules);
  const allowance = group.startsWith("overtime")
    ? rules.timeouts.overtime
    : rules.timeouts[group as "firstHalf" | "secondHalf"];
  return Math.max(0, allowance - (state.teams[side].timeoutsUsed[group] ?? 0));
}

export function teamFoulsThisPeriod(
  state: BasketballGameState,
  side: Side,
  rules: BasketballRules,
) {
  return state.teams[side].teamFouls[foulPeriod(state.period, rules)] ?? 0;
}

/** True when this team's fouls give the other team free throws. */
export function inPenalty(
  state: BasketballGameState,
  side: Side,
  rules: BasketballRules,
) {
  return teamFoulsThisPeriod(state, side, rules) >= rules.teamBonusAfter;
}

/** On-court players who are disqualified and must be replaced. */
export function mustSubstitute(state: BasketballGameState, side: Side) {
  const team = state.teams[side];
  return team.onCourt.filter((id) => team.players[id]?.disqualified);
}

const otherSide = (side: Side): Side => (side === "home" ? "away" : "home");

function player(state: BasketballGameState, side: Side, id: string) {
  return state.teams[side].players[id];
}

function playerOnCourtError(
  state: BasketballGameState,
  side: Side,
  id: string,
): BasketballEventError | null {
  const line = player(state, side, id);
  if (!line) return "unknownPlayer";
  if (line.disqualified) return "playerDisqualified";
  if (!state.teams[side].onCourt.includes(id)) return "playerNotOnCourt";
  return null;
}

/** Game-state checks only; envelope and void checks live in validateBasketballEvent. */
function semanticError(
  state: BasketballGameState,
  event: BasketballEvent,
  rules: BasketballRules,
): BasketballEventError | null {
  const { phase } = state;
  if (
    phase === "final" &&
    !["officials", "team_staff", "confirmation", "protest"].includes(event.type)
  )
    return "gameOver";
  switch (event.type) {
    case "roster":
      return phase === "pregame" ? null : "notPregame";
    case "checkin": {
      const line = player(state, event.payload.team, event.payload.playerId);
      if (!line) return "unknownPlayer";
      return line.present ? "alreadyPresent" : null;
    }
    case "jersey": {
      const team = state.teams[event.payload.team];
      if (!team.players[event.payload.playerId]) return "unknownPlayer";
      return team.playerIds.some(
        (id) =>
          id !== event.payload.playerId &&
          team.players[id].jersey === event.payload.number,
      )
        ? "jerseyTaken"
        : null;
    }
    case "starters": {
      if (phase !== "pregame") return "notPregame";
      const ids = event.payload.playerIds;
      if (ids.length !== 5 || new Set(ids).size !== 5) return "startersNotFive";
      for (const id of ids) {
        const line = player(state, event.payload.team, id);
        if (!line) return "unknownPlayer";
        if (!line.present) return "playerNotPresent";
      }
      return null;
    }
    case "officials":
      return null;
    case "team_staff": {
      const { team, captainId } = event.payload;
      return captainId && !player(state, team, captainId)
        ? "unknownPlayer"
        : null;
    }
    case "confirmation":
    case "protest":
      return phase === "final" ? null : "notFinal";
    case "shot_clock":
    case "shot_clock_violation":
      return phase === "live" ? null : "notLive";
    case "period_start":
      if (phase === "live") return "periodInProgress";
      if (phase === "pregame")
        return sides.every((side) => state.teams[side].startersSet)
          ? null
          : "startersMissing";
      if (
        state.period >= rules.quarters &&
        state.teams.home.score !== state.teams.away.score
      )
        return "regulationOver";
      return null;
    case "period_end":
      return phase === "live" ? null : "notLive";
    case "clock_start":
      if (phase !== "live") return "notLive";
      return state.clock.running ? "clockRunning" : null;
    case "clock_stop":
      if (phase !== "live") return "notLive";
      return state.clock.running ? null : "clockStopped";
    case "score":
    case "stat":
      if (phase !== "live") return "notLive";
      return playerOnCourtError(
        state,
        event.payload.team,
        event.payload.playerId,
      );
    case "foul": {
      const { team, playerId, kind } = event.payload;
      if (!playerId) return null;
      const line = player(state, team, playerId);
      if (!line) return "unknownPlayer";
      if (!line.present) return "playerNotPresent";
      if (line.disqualified) return "playerDisqualified";
      if (kind !== "personal") return null;
      if (phase !== "live") return "notLive";
      return state.teams[team].onCourt.includes(playerId)
        ? null
        : "playerNotOnCourt";
    }
    case "substitution": {
      if (phase === "pregame") return "notLive";
      const team = state.teams[event.payload.team];
      if (!team.players[event.payload.out]) return "unknownPlayer";
      if (!team.onCourt.includes(event.payload.out)) return "playerNotOnCourt";
      const incoming = team.players[event.payload.in];
      if (!incoming) return "unknownPlayer";
      if (!incoming.present) return "playerNotPresent";
      if (incoming.disqualified) return "playerDisqualified";
      return team.onCourt.includes(event.payload.in)
        ? "playerAlreadyOnCourt"
        : null;
    }
    case "timeout":
      if (phase !== "live") return "notLive";
      return timeoutsLeft(state, event.payload.team, rules) > 0
        ? null
        : "noTimeoutsLeft";
    case "possession":
      return null;
    case "jump_ball_won":
      if (phase !== "live") return "notLive";
      return state.possession ? "arrowAlreadySet" : null;
    case "alternating_possession":
      if (phase !== "live") return "notLive";
      if (!state.possession) return "arrowNotSet";
      return state.possession === event.payload.team ? null : "notArrowTeam";
    case "game_end":
      if (phase === "live") return "periodInProgress";
      if (phase !== "break") return "notLive";
      if (state.period < rules.quarters) return "regulationNotOver";
      return state.teams.home.score === state.teams.away.score
        ? "scoreTied"
        : null;
    case "void":
      return null;
  }
}

/**
 * Why `event` cannot be appended to `state`, or null. The scorer screen calls
 * this before saving, so taps that break the rules are blocked up front.
 */
export function validateBasketballEvent(
  state: BasketballGameState,
  event: BasketballEvent,
  rules: BasketballRules,
): BasketballEventError | null {
  if (state.log.some((entry) => entry.eventId === event.id))
    return "duplicateEvent";
  if (event.sequence <= state.lastSequence) return "outOfOrder";
  if (event.type === "void") {
    const target = state.log.find(
      (entry) => entry.eventId === event.payload.eventId,
    );
    if (!target) return "voidTargetMissing";
    return target.type === "void" || target.status === "voided"
      ? "voidTargetInvalid"
      : null;
  }
  return semanticError(state, event, rules);
}

function creditPlayingTime(state: BasketballGameState, ms: number) {
  if (ms <= 0) return;
  for (const side of sides) {
    const team = state.teams[side];
    for (const id of team.onCourt) team.players[id].playedMs += ms;
  }
}

/** Runs the clock up to this event: running time is credited to players on court. */
function syncClock(state: BasketballGameState, event: BasketballEvent) {
  if (state.phase !== "live" || event.clockMs === null) return;
  const remainingMs = Math.min(event.clockMs, state.clock.remainingMs);
  if (state.clock.running) {
    const elapsed = state.clock.remainingMs - remainingMs;
    creditPlayingTime(state, elapsed);
    state.shotClock.remainingMs = Math.max(
      0,
      state.shotClock.remainingMs - elapsed,
    );
  }
  state.clock = { ...state.clock, remainingMs, asOf: event.createdAt };
}

function stopClock(state: BasketballGameState, event: BasketballEvent) {
  state.clock = { ...state.clock, running: false, asOf: event.createdAt };
}

function effect(
  state: BasketballGameState,
  event: BasketballEvent,
  kind: EffectKind,
  team: Side | null = null,
  playerId: string | null = null,
) {
  state.effects.push({ eventId: event.id, kind, team, playerId });
}

function applyFoul(
  state: BasketballGameState,
  event: BasketballEventOf<"foul">,
  rules: BasketballRules,
) {
  const { team: side, playerId, kind, freeThrows } = event.payload;
  const team = state.teams[side];
  if (state.phase === "live" && state.clock.running) stopClock(state, event);
  const opponent: Side = side === "home" ? "away" : "home";
  state.freeThrowsDue = freeThrows
    ? { team: opponent, count: freeThrows }
    : null;
  // Ordinary free-throw awards reset to a full shot clock while play is stopped.
  // Technicals resume the interrupted possession; frontcourt/rebound resets
  // remain operator decisions because this log does not track court position.
  if (state.phase === "live" && kind === "personal" && freeThrows)
    state.shotClock.remainingMs = shotClockMs(rules);
  if (!playerId) {
    // Older games recorded every bench technical as the coach's.
    const offender = event.payload.offender ?? "coach";
    if (kind === "technical") {
      team.benchTechnicals++;
      team.coachFouls[offender]++;
    }
    // FIBA: the coach is out after 2 of their own technicals (C), 3 in all
    // with bench technicals (B), or a disqualifying or fighting foul of their own.
    const out =
      team.coachFouls.coach >= 2 ||
      team.coachFouls.coach + team.coachFouls.bench >= 3 ||
      (offender === "coach" && kind !== "technical");
    if (out && !team.coachEjected) {
      team.coachEjected = true;
      effect(state, event, "coachEjected", side);
    }
    return;
  }
  const line = team.players[playerId];
  line.fouls[kind]++;
  line.foulCount++;
  const { technical, unsportsmanlike, disqualifying, fighting } = line.fouls;
  if (
    disqualifying >= 1 ||
    fighting >= 1 ||
    technical >= 2 ||
    unsportsmanlike >= 2 ||
    technical + unsportsmanlike >= 2
  )
    line.disqualified = "ejected";
  else if (line.foulCount >= rules.foulOut) line.disqualified = "fouledOut";
  if (line.disqualified)
    effect(state, event, line.disqualified, side, playerId);
  else if (line.foulCount === rules.foulOut - 1)
    effect(state, event, "foulWarning", side, playerId);
  // Fouls during breaks are recorded on the player but not as team fouls.
  if (state.phase === "live") {
    const period = foulPeriod(state.period, rules);
    team.teamFouls[period] = (team.teamFouls[period] ?? 0) + 1;
    if (team.teamFouls[period] === rules.teamBonusAfter)
      effect(state, event, "teamPenalty", side);
  }
}

function applyEvent(
  state: BasketballGameState,
  event: BasketballEvent,
  rules: BasketballRules,
) {
  syncClock(state, event);
  switch (event.type) {
    case "roster": {
      const team = state.teams[event.payload.team];
      const previous = team.players;
      team.playerIds = event.payload.players.map((entry) => entry.playerId);
      team.players = Object.fromEntries(
        event.payload.players.map((entry) => [
          entry.playerId,
          {
            playerId: entry.playerId,
            name: entry.name,
            jersey: entry.jersey,
            present: previous[entry.playerId]?.present ?? false,
            starter: false,
            points: 0,
            freeThrows: { made: 0, attempted: 0 },
            twoPointers: { made: 0, attempted: 0 },
            threePointers: { made: 0, attempted: 0 },
            fouls: zeroes(foulKinds),
            foulCount: 0,
            disqualified: null,
            stats: zeroes(statKinds),
            playedMs: 0,
            entered: false,
          } satisfies PlayerLine,
        ]),
      );
      // Pregame fouls stay valid only for players still on the roster.
      for (const id of team.playerIds) {
        const before = previous[id];
        if (!before) continue;
        Object.assign(team.players[id], {
          fouls: before.fouls,
          foulCount: before.foulCount,
          disqualified: before.disqualified,
        });
      }
      team.onCourt = [];
      team.startersSet = false;
      return;
    }
    case "checkin":
      player(state, event.payload.team, event.payload.playerId).present = true;
      return;
    case "jersey":
      player(state, event.payload.team, event.payload.playerId).jersey =
        event.payload.number;
      return;
    case "starters": {
      const team = state.teams[event.payload.team];
      for (const id of team.playerIds) team.players[id].starter = false;
      for (const id of event.payload.playerIds) {
        team.players[id].starter = true;
        team.players[id].entered = true;
      }
      team.onCourt = [...event.payload.playerIds];
      team.startersSet = true;
      return;
    }
    case "officials":
      state.officials = { ...event.payload };
      return;
    case "team_staff": {
      const team = state.teams[event.payload.team];
      team.coach = event.payload.coach;
      team.assistantCoach = event.payload.assistantCoach;
      team.captainId = event.payload.captainId;
      return;
    }
    case "confirmation":
      state.confirmations = [
        ...state.confirmations.filter(
          (entry) => entry.role !== event.payload.role,
        ),
        { ...event.payload, at: event.createdAt },
      ];
      return;
    case "protest":
      state.protests.push({ ...event.payload, at: event.createdAt });
      return;
    case "shot_clock":
      state.shotClock.remainingMs = event.payload.seconds * 1000;
      return;
    case "shot_clock_violation": {
      state.ballControl = otherSide(event.payload.team);
      state.teams[event.payload.team].shotClockViolations++;
      if (state.clock.running) stopClock(state, event);
      state.shotClock.remainingMs = shotClockMs(rules);
      effect(state, event, "shotClockViolation", event.payload.team);
      return;
    }
    case "period_start":
      state.phase = "live";
      state.period++;
      state.ballControl = state.period > 1 ? state.possession : null;
      state.startedAt ??= event.createdAt;
      state.shotClock.remainingMs = shotClockMs(rules);
      state.freeThrowsDue = null;
      // FIBA: every period after the first starts with the arrow's throw-in,
      // and the arrow then points the other way.
      if (state.period > 1 && state.possession) {
        effect(state, event, "periodPossession", state.possession);
        state.possession = otherSide(state.possession);
      }
      state.clock = {
        running: false,
        remainingMs: periodLengthMs(state.period, rules),
        asOf: event.createdAt,
      };
      return;
    case "period_end":
      if (state.clock.running)
        creditPlayingTime(state, state.clock.remainingMs);
      state.phase = "break";
      state.freeThrowsDue = null;
      state.clock = { running: false, remainingMs: 0, asOf: event.createdAt };
      effect(state, event, "periodEnd");
      return;
    case "clock_start":
      state.clock = { ...state.clock, running: true, asOf: event.createdAt };
      return;
    case "clock_stop":
      stopClock(state, event);
      return;
    case "score": {
      const { team: side, playerId, points, made } = event.payload;
      if (points > 1) state.ballControl = made ? otherSide(side) : side;
      const team = state.teams[side];
      const line = team.players[playerId];
      const shots =
        points === 1
          ? line.freeThrows
          : points === 2
            ? line.twoPointers
            : line.threePointers;
      shots.attempted++;
      if (points === 1 && state.freeThrowsDue?.team === side) {
        const count = state.freeThrowsDue.count - 1;
        state.freeThrowsDue = count > 0 ? { team: side, count } : null;
      } else if (points > 1) state.freeThrowsDue = null;
      if (!made) return;
      // A made field goal resets the shot clock for the other team.
      if (points > 1) state.shotClock.remainingMs = shotClockMs(rules);
      shots.made++;
      line.points += points;
      team.score += points;
      team.pointsByPeriod[state.period] =
        (team.pointsByPeriod[state.period] ?? 0) + points;
      if (points === 3) effect(state, event, "madeThree", side, playerId);
      return;
    }
    case "foul":
      applyFoul(state, event, rules);
      return;
    case "substitution": {
      const team = state.teams[event.payload.team];
      team.onCourt = team.onCourt.map((id) =>
        id === event.payload.out ? event.payload.in : id,
      );
      team.players[event.payload.in].entered = true;
      effect(
        state,
        event,
        "substitution",
        event.payload.team,
        event.payload.in,
      );
      return;
    }
    case "timeout": {
      const team = state.teams[event.payload.team];
      const group = timeoutGroup(state.period, rules);
      team.timeoutsUsed[group] = (team.timeoutsUsed[group] ?? 0) + 1;
      team.timeouts.push({
        period: state.period,
        clockMs: state.clock.remainingMs,
      });
      if (state.clock.running) stopClock(state, event);
      effect(state, event, "timeout", event.payload.team);
      return;
    }
    case "stat": {
      player(state, event.payload.team, event.payload.playerId).stats[
        event.payload.kind
      ]++;
      const { team, kind, reboundType, rimHit } = event.payload;
      if (kind === "rebound" && reboundType) {
        state.ballControl = team;
        if (reboundType === "defensive")
          state.shotClock.remainingMs = shotClockMs(rules);
        else if (rimHit !== false)
          state.shotClock.remainingMs = rules.shotClock.resetSeconds * 1000;
      } else if (kind === "turnover" || kind === "steal") {
        const next = kind === "turnover" ? otherSide(team) : team;
        // A turnover and the matching steal describe one possession change.
        if (state.ballControl !== next)
          state.shotClock.remainingMs = shotClockMs(rules);
        state.ballControl = next;
      }
      return;
    }
    case "possession":
      state.possession = event.payload.team;
      return;
    case "jump_ball_won":
      state.ballControl = event.payload.team;
      state.possession = otherSide(event.payload.team);
      effect(state, event, "openingTip", event.payload.team);
      return;
    case "alternating_possession":
      state.ballControl = event.payload.team;
      effect(state, event, "jumpBall", event.payload.team);
      state.possession = otherSide(event.payload.team);
      if (state.clock.running) stopClock(state, event);
      return;
    case "game_end":
      state.phase = "final";
      state.endedAt = event.createdAt;
      state.winner =
        state.teams.home.score > state.teams.away.score ? "home" : "away";
      effect(state, event, "gameEnd", state.winner);
      return;
    case "void":
      return;
  }
}

/**
 * Derives the whole game from its event log. Never throws for a bad event:
 * duplicates are dropped, and events that do not apply (for example after an
 * earlier correction) are logged as ignored with the reason.
 */
export function reduceBasketballGame(
  events: readonly BasketballEvent[],
  rules: BasketballRules,
): BasketballGameState {
  const seen = new Set<string>();
  const ordered = events
    .filter((event) => !seen.has(event.id) && seen.add(event.id))
    .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  const byId = new Map(ordered.map((event) => [event.id, event]));
  const voided = new Set<string>();
  const invalidVoids = new Set<string>();
  for (const event of ordered) {
    if (event.type !== "void") continue;
    const target = byId.get(event.payload.eventId);
    if (
      target &&
      target.sequence < event.sequence &&
      target.type !== "void" &&
      !voided.has(target.id)
    )
      voided.add(target.id);
    else invalidVoids.add(event.id);
  }
  const state = initialBasketballState();
  for (const event of ordered) {
    let status: EventStatus = "applied";
    let error: BasketballEventError | null = null;
    if (event.type === "void") {
      status = invalidVoids.has(event.id) ? "ignored" : "void";
      if (status === "ignored")
        error = byId.has(event.payload.eventId)
          ? "voidTargetInvalid"
          : "voidTargetMissing";
    } else if (voided.has(event.id)) status = "voided";
    else {
      error = semanticError(state, event, rules);
      if (error) status = "ignored";
      else applyEvent(state, event, rules);
    }
    state.log.push({
      eventId: event.id,
      sequence: event.sequence,
      type: event.type,
      status,
      error,
    });
    state.lastSequence = event.sequence;
  }
  return state;
}

/** The newest action Undo should void, if any. */
export function lastUndoableEvent(state: BasketballGameState) {
  return (
    [...state.log]
      .reverse()
      .find((entry) => entry.status === "applied" && entry.type !== "roster") ??
    null
  );
}

export interface BoxScoreRow {
  playerId: string;
  name: string;
  jersey: number;
  starter: boolean;
  minutes: number;
  points: number;
  fieldGoals: ShotLine;
  threePointers: ShotLine;
  freeThrows: ShotLine;
  fouls: number;
  disqualified: Disqualification | null;
  stats: Record<StatKind, number>;
}

/** Players who were present, in roster order, plus team totals. */
export function boxScore(state: BasketballGameState, side: Side) {
  const team = state.teams[side];
  const rows: BoxScoreRow[] = team.playerIds
    .map((id) => team.players[id])
    .filter((line) => line.present)
    .map((line) => ({
      playerId: line.playerId,
      name: line.name,
      jersey: line.jersey,
      starter: line.starter,
      minutes: Math.floor(line.playedMs / 60_000),
      points: line.points,
      fieldGoals: {
        made: line.twoPointers.made + line.threePointers.made,
        attempted: line.twoPointers.attempted + line.threePointers.attempted,
      },
      threePointers: { ...line.threePointers },
      freeThrows: { ...line.freeThrows },
      fouls: line.foulCount,
      disqualified: line.disqualified,
      stats: { ...line.stats },
    }));
  const sum = (pick: (row: BoxScoreRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  const shots = (pick: (row: BoxScoreRow) => ShotLine) => ({
    made: sum((row) => pick(row).made),
    attempted: sum((row) => pick(row).attempted),
  });
  return {
    rows,
    totals: {
      points: team.score,
      fieldGoals: shots((row) => row.fieldGoals),
      threePointers: shots((row) => row.threePointers),
      freeThrows: shots((row) => row.freeThrows),
      fouls: sum((row) => row.fouls),
      stats: Object.fromEntries(
        statKinds.map((kind) => [kind, sum((row) => row.stats[kind])]),
      ) as Record<StatKind, number>,
    },
  };
}
