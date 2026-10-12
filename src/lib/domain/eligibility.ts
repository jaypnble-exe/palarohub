import { isRatingAllowed } from "./ratings";

export interface EligibilityPlayer {
  id: string;
  name: string;
  rating: string | null;
  jerseyNumber: number;
  suspended: boolean;
  documentsPresent: boolean;
  onAnotherTeam: boolean;
}
export interface EligibilityRules {
  ratingScale: readonly string[];
  maximumRating: string;
  rosterMin: number;
  rosterMax: number;
  requireDocuments: boolean;
}
export type EligibilityCode =
  | "rosterTooSmall"
  | "rosterTooLarge"
  | "ratingMissing"
  | "ratingTooHigh"
  | "ratingUnknown"
  | "playerSuspended"
  | "documentsMissing"
  | "anotherTeam"
  | "duplicatePlayer"
  | "duplicateJersey";
export interface EligibilityIssue {
  code: EligibilityCode;
  playerId?: string;
  name?: string;
  rating?: string;
  maximumRating?: string;
  min?: number;
  max?: number;
}

/** Pure checks shared by live roster feedback and submission validation. */
export function checkRosterEligibility(
  players: readonly EligibilityPlayer[],
  rules: EligibilityRules,
): EligibilityIssue[] {
  const issues: EligibilityIssue[] = [];
  if (players.length < rules.rosterMin)
    issues.push({ code: "rosterTooSmall", min: rules.rosterMin });
  if (players.length > rules.rosterMax)
    issues.push({ code: "rosterTooLarge", max: rules.rosterMax });
  const ids = new Set<string>();
  const jerseys = new Set<number>();
  for (const player of players) {
    const detail = { playerId: player.id, name: player.name };
    if (ids.has(player.id)) issues.push({ code: "duplicatePlayer", ...detail });
    if (jerseys.has(player.jerseyNumber))
      issues.push({ code: "duplicateJersey", ...detail });
    ids.add(player.id);
    jerseys.add(player.jerseyNumber);
    if (!player.rating) issues.push({ code: "ratingMissing", ...detail });
    else if (
      !rules.ratingScale.includes(player.rating) ||
      !rules.ratingScale.includes(rules.maximumRating)
    )
      issues.push({ code: "ratingUnknown", ...detail, rating: player.rating });
    else if (
      !isRatingAllowed(rules.ratingScale, player.rating, rules.maximumRating)
    )
      issues.push({
        code: "ratingTooHigh",
        ...detail,
        rating: player.rating,
        maximumRating: rules.maximumRating,
      });
    if (player.suspended) issues.push({ code: "playerSuspended", ...detail });
    if (rules.requireDocuments && !player.documentsPresent)
      issues.push({ code: "documentsMissing", ...detail });
    if (player.onAnotherTeam) issues.push({ code: "anotherTeam", ...detail });
  }
  return issues;
}

export interface RatingHistoryEntry {
  id: string;
  rating: string;
  effectiveFrom: string;
  createdAt: string;
}
/** Future entries do not take effect early; creation time and ID break ties. */
export function currentPlayerRating(
  history: readonly RatingHistoryEntry[],
  asOf: string,
): RatingHistoryEntry | null {
  const cutoff = Date.parse(asOf);
  const eligible = history.filter(
    (entry) => Date.parse(entry.effectiveFrom) <= cutoff,
  );
  return (
    eligible.sort(
      (a, b) =>
        Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        b.id.localeCompare(a.id),
    )[0] ?? null
  );
}

export function registrationIsOpen(
  settings: { isOpen: boolean; deadline: string },
  now: string,
): boolean {
  return settings.isOpen && Date.parse(now) < Date.parse(settings.deadline);
}
