export type SeasonPhase = "draft" | "upcoming" | "inProgress" | "finished";

const DAY_MS = 86400000;
const day = (value: string) => new Date(`${value}T12:00:00Z`).getTime();

/** Where a season stands, from its status and its dates (yyyy-mm-dd, Saudi days). */
export function seasonPhase(
  season: { status: string; start_date: string; end_date: string },
  today: string,
): SeasonPhase {
  if (season.status !== "published") return "draft";
  if (today < season.start_date) return "upcoming";
  if (today > season.end_date) return "finished";
  return "inProgress";
}

/** "Week 3 of 13" for a season in progress, as numbers. */
export function seasonWeek(
  season: { start_date: string; end_date: string },
  today: string,
) {
  // Same rounding as the season's "13 weeks long" in setup.
  const total = Math.max(
    1,
    Math.round((day(season.end_date) - day(season.start_date)) / (7 * DAY_MS)),
  );
  const current = Math.min(
    total,
    Math.max(
      1,
      Math.floor((day(today) - day(season.start_date)) / (7 * DAY_MS)) + 1,
    ),
  );
  return { current, total };
}

/** Today's date in Saudi Arabia (UTC+3), as yyyy-mm-dd. */
export function riyadhToday(now: Date) {
  return new Date(now.getTime() + 3 * 3600000).toISOString().slice(0, 10);
}
