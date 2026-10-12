import { z } from "zod";
import type { Json, Tables } from "./supabase/database.types";
import { getSportModule, supportedSports } from "./sports/registry";
import type { GameEventEnvelope } from "./sports/types";

type GameEventRow = Pick<
  Tables<"game_events">,
  "id" | "sequence" | "type" | "payload" | "clock_ms" | "occurred_at"
>;

/**
 * Turns stored rows into the sport module's events. Rows that do not match
 * the module's schema are reported, never passed to the reducer.
 */
export function parseGameEvents(sport: string, rows: readonly GameEventRow[]) {
  const { eventSchema } = getSportModule(sport);
  const events: z.output<typeof eventSchema>[] = [];
  const invalid: string[] = [];
  for (const row of rows) {
    const parsed = eventSchema.safeParse({
      id: row.id,
      sequence: row.sequence,
      clockMs: row.clock_ms,
      createdAt: row.occurred_at,
      type: row.type,
      payload: row.payload,
    });
    if (parsed.success) events.push(parsed.data);
    else invalid.push(row.id);
  }
  return { events, invalid };
}

/** One item of the record_game_events batch. */
export function toRecordedEvent(
  event: GameEventEnvelope & { type: string; payload: object },
  period: number | null,
) {
  return {
    id: event.id,
    sequence: event.sequence,
    type: event.type,
    payload: event.payload as Json,
    clockMs: event.clockMs,
    period,
    occurredAt: event.createdAt,
  };
}

const scorerTeamSchema = z.object({
  seasonTeamId: z.uuid(),
  name: z.string(),
  players: z.array(
    z.object({
      playerId: z.uuid(),
      name: z.string().min(1),
      jersey: z.number().int(),
      suspended: z.boolean().default(false),
    }),
  ),
});

/** What scorer_game_setup returns; the scorer screen caches it offline. */
export const scorerSetupSchema = z
  .object({
    gameId: z.uuid(),
    leagueId: z.uuid(),
    leagueName: z.string(),
    seasonName: z.string(),
    divisionName: z.string(),
    sport: z.enum(supportedSports),
    rules: z.unknown(),
    scheduledAt: z.string().nullable(),
    venue: z.string(),
    status: z.string(),
    teams: z.object({ home: scorerTeamSchema, away: scorerTeamSchema }),
  })
  .transform((setup) => ({
    ...setup,
    rules: getSportModule(setup.sport).rulesSchema.parse(setup.rules),
  }));
export type ScorerSetup = z.output<typeof scorerSetupSchema>;
