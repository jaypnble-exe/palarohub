import { z } from "zod";

/** One game as the public TV feed (`tv_game`) returns it. */
export const tvGameSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  scheduledAt: z.string().nullable(),
  venue: z.string(),
  round: z.number().nullable(),
  leagueName: z.string(),
  leagueSlug: z.string(),
  seasonName: z.string(),
  divisionName: z.string(),
  sport: z.string(),
  rules: z.unknown(),
  homeName: z.string().nullable(),
  awayName: z.string().nullable(),
});
export const tvEventRowSchema = z.object({
  id: z.uuid(),
  sequence: z.number().int(),
  type: z.string(),
  payload: z.unknown(),
  clockMs: z.number().nullable(),
  occurredAt: z.string(),
  createdAt: z.string(),
});
export const tvFeedSchema = z.object({
  game: tvGameSchema,
  serverTime: z.string(),
  events: z.array(tvEventRowSchema),
});
export type TvGame = z.output<typeof tvGameSchema>;
export type TvEventRow = z.output<typeof tvEventRowSchema>;
export type TvFeed = z.output<typeof tvFeedSchema>;

/** Adds newly fetched actions to the ones already on screen, in order, once each. */
export function mergeEvents(
  current: readonly TvEventRow[],
  incoming: readonly TvEventRow[],
): TvEventRow[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

/**
 * How far the scorer's device clock is behind the server, in ms. Each action
 * is stamped by the device (occurredAt) and again by the server (createdAt);
 * the smallest gap is the clock difference plus the quickest upload, so it is
 * the best estimate. Actions sent later from offline have bigger gaps and are
 * ignored by taking the minimum.
 */
export function scorerOffsetMs(events: readonly TvEventRow[]) {
  let best: number | null = null;
  for (const event of events) {
    const gap = Date.parse(event.createdAt) - Date.parse(event.occurredAt);
    if (Number.isFinite(gap) && (best === null || gap < best)) best = gap;
  }
  return best ?? 0;
}

/**
 * Time left on a running clock as this screen should show it: the scorer's
 * last reading, minus the time since, measured on the server's clock so a
 * wrong clock on either device does not matter.
 */
export function remainingOnScreen({
  remainingMs,
  running,
  asOf,
  now,
  screenOffsetMs,
  scorerOffset,
}: {
  remainingMs: number;
  running: boolean;
  /** The scorer device's time of the last clock reading. */
  asOf: string | null;
  /** This screen's own time. */
  now: number;
  /** Server time minus this screen's time. */
  screenOffsetMs: number;
  /** Server time minus the scorer device's time. */
  scorerOffset: number;
}) {
  if (!running || !asOf) return remainingMs;
  const elapsed = now + screenOffsetMs - (Date.parse(asOf) + scorerOffset);
  return Math.max(0, remainingMs - Math.max(0, elapsed));
}
