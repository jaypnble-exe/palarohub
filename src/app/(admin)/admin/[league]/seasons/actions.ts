"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueAccess } from "@/lib/league-access";
import { seasonSchema, ratingScaleSchema } from "@/lib/validation/seasons";
import { getSportModule } from "@/lib/sports/registry";
import { seasonStandings } from "@/lib/standings-data";

export async function saveSeason(
  slug: string,
  seasonId: string | null,
  input: unknown,
) {
  const { supabase, league, canManage } = await getLeagueAccess(slug);
  if (!canManage) return { error: "notAllowed" as const };
  if (seasonId && !z.uuid().safeParse(seasonId).success)
    return { error: "invalidSetup" as const };
  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidSetup" as const };
  const setup = parsed.data;
  const rules = getSportModule(setup.sport).rulesSchema.parse(setup.rules);
  const divisions = setup.divisions.map((division) => ({
    ...division,
    rules:
      division.rules === null
        ? null
        : getSportModule(division.sport).rulesSchema.parse(division.rules),
  }));
  const { data, error } = await supabase.rpc("save_season_setup", {
    p_league_id: league.id,
    p_season_id: seasonId ?? undefined,
    p_setup: { ...setup, rules, divisions },
  });
  if (error) {
    if (error.message.includes("rating_scale_changed"))
      return { error: "ratingsChanged" as const };
    if (
      error.message.includes("season_not_editable") ||
      error.message.includes("published_season_locked")
    )
      return { error: "locked" as const };
    if (error.code === "23505") return { error: "duplicateDivision" as const };
    return { error: "saveFailed" as const };
  }
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/admin/${slug}/seasons`);
  if (data) revalidatePath(`/admin/${slug}/seasons/${data}`);
  revalidatePath(`/${slug}`);
  return { seasonId: data };
}

export async function saveRatingScale(slug: string, input: unknown) {
  const { supabase, league, canManage } = await getLeagueAccess(slug);
  if (!canManage) return { error: "notAllowed" as const };
  const parsed = ratingScaleSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidScale" as const };
  const { error } = await supabase
    .from("league_rating_scales")
    .update({ labels: parsed.data, updated_at: new Date().toISOString() })
    .eq("league_id", league.id);
  if (error) return { error: "saveFailed" as const };
  revalidatePath(`/admin/${slug}/ratings`);
  revalidatePath(`/admin/${slug}/seasons/new`);
  return { success: true as const };
}

/**
 * Closes a finished season: the final standings are worked out here, the same
 * way the standings page does, and saved with the season for good.
 */
export async function closeSeason(slug: string, seasonId: unknown) {
  if (!z.uuid().safeParse(seasonId).success)
    return { error: "invalidSetup" as const };
  const { supabase, league, canManage } = await getLeagueAccess(slug);
  if (!canManage) return { error: "notAllowed" as const };
  const { data: divisions, error: loadError } = await supabase
    .from("divisions")
    .select("id,name,sport")
    .eq("league_id", league.id)
    .eq("season_id", seasonId as string);
  if (loadError) return { error: "saveFailed" as const };
  const standings = await seasonStandings(
    supabase,
    league.id,
    seasonId as string,
    divisions,
  );
  const { error } = await supabase.rpc("close_season", {
    p_league_id: league.id,
    p_season_id: seasonId as string,
    p_standings: JSON.parse(JSON.stringify(standings)),
  });
  if (error) {
    if (error.message.includes("games_without_result"))
      return { error: "gamesWithoutResult" as const };
    if (error.message.includes("season_closed"))
      return { error: "alreadyClosed" as const };
    if (error.code === "42501") return { error: "notAllowed" as const };
    return { error: "saveFailed" as const };
  }
  revalidatePath(`/admin/${slug}`, "layout");
  revalidatePath(`/${slug}`, "layout");
  return { success: true as const };
}
