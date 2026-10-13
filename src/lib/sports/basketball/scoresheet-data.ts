import type { BasketballEvent, BenchOffender, FoulKind, Side } from "./events";
import type { BasketballGameState } from "./reducer";

export interface FoulMark {
  kind: FoulKind;
  period: number;
  /** Free throws awarded for it: the 2 in P2. */
  freeThrows: number;
}

/** A foul on the coach (C) or the bench (B), for the coach's foul boxes. */
export interface BenchFoulMark extends FoulMark {
  offender: BenchOffender;
}

export interface RunningScoreMark {
  /** Team total after this basket. */
  total: number;
  points: 1 | 2 | 3;
  jersey: number;
  period: number;
}

/**
 * What the paper scoresheet shows beyond the box score: each player's fouls in
 * order (the foul boxes) and the running score. Only events that counted.
 */
export function scoresheetMarks(
  state: BasketballGameState,
  events: readonly BasketballEvent[],
) {
  const byId = new Map(events.map((event) => [event.id, event]));
  const fouls: Record<Side, Record<string, FoulMark[]>> = {
    home: {},
    away: {},
  };
  const bench: Record<Side, BenchFoulMark[]> = { home: [], away: [] };
  const running: Record<Side, RunningScoreMark[]> = { home: [], away: [] };
  const totals: Record<Side, number> = { home: 0, away: 0 };
  let period = 0;
  for (const entry of state.log) {
    if (entry.status !== "applied") continue;
    const event = byId.get(entry.eventId);
    if (!event) continue;
    if (event.type === "period_start") period++;
    if (event.type === "foul") {
      const mark = {
        kind: event.payload.kind,
        period,
        freeThrows: event.payload.freeThrows ?? 0,
      };
      if (event.payload.playerId)
        (fouls[event.payload.team][event.payload.playerId] ??= []).push(mark);
      else
        bench[event.payload.team].push({
          ...mark,
          offender: event.payload.offender ?? "coach",
        });
    }
    if (event.type === "score" && event.payload.made) {
      const side = event.payload.team;
      totals[side] += event.payload.points;
      running[side].push({
        total: totals[side],
        points: event.payload.points,
        jersey: state.teams[side].players[event.payload.playerId]?.jersey ?? 0,
        period,
      });
    }
  }
  return { fouls, bench, running };
}
