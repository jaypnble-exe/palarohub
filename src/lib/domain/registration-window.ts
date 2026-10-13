/** Saudi Arabia keeps UTC+3 all year. */
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RegistrationState = "notSetUp" | "open" | "closed" | "ended";

/**
 * Whether team managers can register right now: open and before the
 * deadline. A season with no settings saved yet is "not set up".
 */
export function registrationState(
  settings: { isOpen: boolean; deadline: string } | null,
  now: Date,
): RegistrationState {
  if (!settings) return "notSetUp";
  if (new Date(settings.deadline).getTime() <= now.getTime()) return "ended";
  return settings.isOpen ? "open" : "closed";
}

/** 11:59 PM Saudi time, a number of days from today (Saudi date). */
export function deadlineInDays(now: Date, days: number): string {
  const riyadh = new Date(now.getTime() + RIYADH_OFFSET_MS);
  const endOfDay = Date.UTC(
    riyadh.getUTCFullYear(),
    riyadh.getUTCMonth(),
    riyadh.getUTCDate() + days,
    23,
    59,
  );
  return new Date(endOfDay - RIYADH_OFFSET_MS).toISOString();
}

/** Whole days left until the deadline, never negative. */
export function daysLeft(deadline: string, now: Date) {
  return Math.max(
    0,
    Math.ceil((new Date(deadline).getTime() - now.getTime()) / DAY_MS),
  );
}
