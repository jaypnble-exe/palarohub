import { fromRiyadhDateTimeInput } from "./riyadh-time";

export interface Pairing {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

export interface ScheduledGame extends Pairing {
  /** UTC ISO timestamp. */
  scheduledAt: string;
  venue: string;
}

export interface SlotOptions {
  /** First possible game date, YYYY-MM-DD in Riyadh. */
  startDate: string;
  /** Weekdays games are played on: 0 = Sunday … 6 = Saturday. */
  gameDays: readonly number[];
  /** Tip-off times in Riyadh, HH:MM. */
  times: readonly string[];
  venues: readonly string[];
}

export type ScheduleResult =
  | { games: ScheduledGame[]; lastDate: string; gameDayCount: number }
  | { error: "notEnoughTeams" | "noSlots" | "tooLong" };

export const MAX_SCHEDULE_TEAMS = 40;
const MAX_SCHEDULE_DAYS = 3 * 366;

/**
 * Circle-method round robin: every team meets every other team once per leg,
 * plays at most once per round, and an odd team count gives one bye per round.
 * Home games are balanced greedily; a second leg swaps every home and away.
 */
export function roundRobinPairings(
  teamIds: readonly string[],
  twice = false,
): Pairing[] {
  if (teamIds.length < 2) return [];
  const circle: (string | null)[] = [...teamIds];
  if (circle.length % 2) circle.push(null);
  const size = circle.length;
  const balance = new Map(teamIds.map((id) => [id, 0]));
  const firstLeg: Pairing[] = [];
  for (let round = 1; round < size; round++) {
    for (let index = 0; index < size / 2; index++) {
      const first = circle[index];
      const second = circle[size - 1 - index];
      if (!first || !second) continue;
      const firstBalance = balance.get(first) ?? 0;
      const secondBalance = balance.get(second) ?? 0;
      const firstHome =
        firstBalance === secondBalance
          ? (round + index) % 2 === 1
          : firstBalance < secondBalance;
      const [home, away] = firstHome ? [first, second] : [second, first];
      balance.set(home, (balance.get(home) ?? 0) + 1);
      balance.set(away, (balance.get(away) ?? 0) - 1);
      firstLeg.push({ round, homeTeamId: home, awayTeamId: away });
    }
    // Keep the first team fixed and rotate everyone else one place.
    circle.splice(1, 0, circle.pop() ?? null);
  }
  if (!twice) return firstLeg;
  const rounds = size - 1;
  return [
    ...firstLeg,
    ...firstLeg.map((game) => ({
      round: game.round + rounds,
      homeTeamId: game.awayTeamId,
      awayTeamId: game.homeTeamId,
    })),
  ];
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/**
 * Places games, in round order, into each game day's slots (earliest time
 * first, then each court). A team never plays twice on the same day.
 */
export function buildSchedule(
  teamIds: readonly string[],
  twice: boolean,
  options: SlotOptions,
): ScheduleResult {
  if (teamIds.length < 2 || new Set(teamIds).size !== teamIds.length)
    return { error: "notEnoughTeams" };
  if (teamIds.length > MAX_SCHEDULE_TEAMS) return { error: "tooLong" };
  const times = [...new Set(options.times)].sort();
  const venues = [...new Set(options.venues.map((venue) => venue.trim()))];
  const days = new Set(options.gameDays);
  if (!times.length || !venues.length || !days.size)
    return { error: "noSlots" };
  const pending = roundRobinPairings(teamIds, twice);
  const games: ScheduledGame[] = [];
  let date = options.startDate;
  let lastDate = date;
  let gameDayCount = 0;
  for (let offset = 0; pending.length; offset++) {
    if (offset > MAX_SCHEDULE_DAYS) return { error: "tooLong" };
    date = addDays(options.startDate, offset);
    if (!days.has(new Date(`${date}T12:00:00Z`).getUTCDay())) continue;
    const busy = new Set<string>();
    let placed = 0;
    for (const time of times) {
      const scheduledAt = fromRiyadhDateTimeInput(`${date}T${time}`);
      if (!scheduledAt) return { error: "noSlots" };
      for (const venue of venues) {
        const index = pending.findIndex(
          (game) => !busy.has(game.homeTeamId) && !busy.has(game.awayTeamId),
        );
        if (index < 0) break;
        const [game] = pending.splice(index, 1);
        busy.add(game.homeTeamId).add(game.awayTeamId);
        games.push({ ...game, scheduledAt, venue });
        placed++;
      }
    }
    if (placed) {
      lastDate = date;
      gameDayCount++;
    }
  }
  return { games, lastDate, gameDayCount };
}
