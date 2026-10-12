import "server-only";
import type { Database } from "./supabase/database.types";
import { getSportModule } from "./sports/registry";
import { seasonSchema, type SeasonFormInput } from "./validation/seasons";

type Season = Database["public"]["Tables"]["seasons"]["Row"];
type Division = Database["public"]["Tables"]["divisions"]["Row"];

export function seasonFormValues(
  season: Season,
  divisions: Division[],
): SeasonFormInput {
  return seasonSchema.parse({
    name: season.name,
    startDate: season.start_date,
    endDate: season.end_date,
    sport: season.sport,
    rules: getSportModule(season.sport).rulesSchema.parse(season.rules),
    ratingScale: season.rating_scale,
    status: season.status,
    divisions: divisions.map((division) => ({
      id: division.id,
      name: division.name,
      sport: division.sport,
      maxRating: division.max_rating,
      rosterMin: division.roster_min,
      rosterMax: division.roster_max,
      rules:
        division.rules === null
          ? null
          : getSportModule(division.sport).rulesSchema.parse(division.rules),
    })),
  });
}
