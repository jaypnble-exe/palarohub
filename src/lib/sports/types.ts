import { z } from "zod";
import type { Tiebreaker } from "../domain/standings";

export type Sport = "basketball";
export type GameResult = "win" | "loss" | "draw" | "forfeit";
export interface StatDefinition {
  key: string;
  labelKey: string;
}

/**
 * Sport-neutral part of every game event. game_id, league_id, period, and
 * created_by live on the stored row; the reducer needs only these fields.
 */
export const gameEventEnvelopeSchema = z.strictObject({
  /** Client-generated, so offline retries are idempotent. */
  id: z.uuid(),
  sequence: z.number().int().min(1),
  /** Game clock remaining in the period when the event happened, if known. */
  clockMs: z.number().int().min(0).max(3_600_000).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type GameEventEnvelope = z.output<typeof gameEventEnvelopeSchema>;

/** The official result of a finished game, stored when staff approve it. */
export interface GameSummary {
  homeScore: number;
  awayScore: number;
  /** Sport-specific record (box score, fouls, officials), stored as JSON. */
  summary: Record<string, unknown>;
  /** Players ejected in this game; staff choose who is suspended. */
  ejectedPlayers: {
    playerId: string;
    name: string;
    jersey: number;
    team: "home" | "away";
  }[];
}

/**
 * The score of a game so far, for schedules, dashboards and live lists. The
 * status is a message key under "LiveStatus" (e.g. "basketball.quarter"), so
 * shared screens can show "Q3 · 4:12" without knowing the sport.
 */
export interface LiveScore {
  homeScore: number;
  awayScore: number;
  status: { key: string; values?: Record<string, string | number> };
}

/** Sport-specific event payloads and rules stay inside each module. */
export interface SportModule<Rules, Event, State, EventError = string> {
  sport: Sport;
  eventSchema: z.ZodType<Event, unknown>;
  rulesSchema: z.ZodType<Rules, unknown>;
  defaultRules: Readonly<Rules>;
  /** Pure: the same events and rules always give the same state. */
  reduceGame(events: readonly Event[], rules: Rules): State;
  /** Why an event cannot be added to the current state, or null if it can. */
  validateEvent(state: State, event: Event, rules: Rules): EventError | null;
  /** The official result once the game has ended, otherwise null. */
  summarizeGame(
    state: State,
    teamNames: Record<"home" | "away", string>,
  ): GameSummary | null;
  /** The score and where the game stands, at any point in the game. */
  liveScore(state: State, rules: Rules): LiveScore;
  stats: readonly StatDefinition[];
  standingsPoints(result: GameResult): number;
  /** Applied in order to teams level on standings points. */
  tiebreakers: readonly Tiebreaker[];
  ui: {
    rulesForm: string | null;
    scorer: string | null;
    tv: string | null;
    pdf: string | null;
    flashes: readonly string[];
  };
}
