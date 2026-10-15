import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { getLeagueAccess } from "./league-access";
import type { Database } from "./supabase/database.types";
import { registrationMedia } from "./registration-media";
import {
  catalogPlayerSchema,
  playersForDivision,
  type CatalogPlayer,
  type RegistrationPlayer,
  type RosterEntryInput,
} from "./validation/registration";
import {
  checkRosterEligibility,
  type EligibilityIssue,
} from "./domain/eligibility";

export type Registration = Database["public"]["Tables"]["season_teams"]["Row"];
export type RegistrationSettings =
  Database["public"]["Tables"]["registration_settings"]["Row"];
export type RegistrationDivision =
  Database["public"]["Tables"]["divisions"]["Row"];
export type RegistrationSeason = Database["public"]["Tables"]["seasons"]["Row"];
export function parsePlayerCatalog(value: unknown): CatalogPlayer[] {
  return z.array(catalogPlayerSchema).parse(value);
}
export function rosterEligibility(
  roster: readonly RosterEntryInput[],
  catalog: readonly RegistrationPlayer[],
  season: RegistrationSeason,
  division: RegistrationDivision,
  settings: RegistrationSettings,
): EligibilityIssue[] {
  return checkRosterEligibility(
    roster.map((entry) => {
      const player = catalog.find((item) => item.id === entry.playerId);
      if (!player)
        throw new Error("Roster player missing from the authorized catalog.");
      return { ...player, jerseyNumber: entry.jerseyNumber };
    }),
    {
      ratingScale: season.rating_scale,
      maximumRating: division.max_rating,
      rosterMin: division.roster_min,
      rosterMax: division.roster_max,
      requireDocuments: settings.require_documents,
    },
  );
}

export async function loadRegistration(
  slug: string,
  id: string,
  workspace: "admin" | "team",
) {
  if (!z.uuid().safeParse(id).success) notFound();
  const access = await getLeagueAccess(slug, workspace);
  if (workspace === "admin" ? !access.canView : !access.canRegister)
    return { denied: true as const };
  const { supabase, league } = access;
  const { data: registration, error } = await supabase
    .from("season_teams")
    .select("*")
    .eq("league_id", league.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load registration.");
  if (!registration) notFound();
  const results = await Promise.all([
    supabase
      .from("seasons")
      .select("*")
      .eq("league_id", league.id)
      .eq("id", registration.season_id)
      .single(),
    supabase
      .from("divisions")
      .select("*")
      .eq("league_id", league.id)
      .eq("id", registration.division_id)
      .single(),
    supabase
      .from("registration_settings")
      .select("*")
      .eq("league_id", league.id)
      .eq("season_id", registration.season_id)
      .single(),
    supabase
      .from("teams")
      .select("id,name,manager_id")
      .eq("league_id", league.id)
      .eq("id", registration.team_id)
      .single(),
    supabase
      .from("roster_entries")
      .select("*")
      .eq("league_id", league.id)
      .eq("registration_id", registration.id)
      .order("jersey_number"),
    supabase
      .from("registration_reviews")
      .select("action,comment,created_at,profiles(display_name)")
      .eq("league_id", league.id)
      .eq("registration_id", registration.id)
      .order("created_at"),
    supabase
      .from("roster_change_requests")
      .select("*")
      .eq("league_id", league.id)
      .eq("registration_id", registration.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("registration_player_catalog", {
      p_league_id: league.id,
      p_season_id: registration.season_id,
      p_registration_id: registration.id,
    }),
  ]);
  if (results.some((result) => result.error))
    throw new Error("Unable to load registration details.");
  const [season, division, settings, team, entries, reviews, changes, catalog] =
    results;
  if (!season.data || !division.data || !settings.data || !team.data)
    throw new Error("Registration configuration is missing.");
  const playerCatalog = parsePlayerCatalog(catalog.data);
  const media = await registrationMedia(supabase, registration);
  return {
    denied: false as const,
    ...access,
    registration,
    media,
    season: season.data,
    division: division.data,
    settings: settings.data,
    team: team.data,
    entries: entries.data ?? [],
    reviews: reviews.data ?? [],
    changes: changes.data ?? [],
    /** Players as seen for this registration's division. */
    catalog: playersForDivision(playerCatalog, registration.division_id),
    /** Every division's view, for a draft that may move to another division. */
    playerCatalog,
  };
}
