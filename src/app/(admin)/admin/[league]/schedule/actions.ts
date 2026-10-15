"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueAccess } from "@/lib/league-access";
import { buildSchedule } from "@/lib/domain/round-robin";
import {
  addGameSchema,
  gameUpdateSchema,
  scheduleSetupSchema,
  type ScheduleActionResult,
} from "@/lib/validation/schedule";

function failure(error: {
  message: string;
  code?: string;
}): ScheduleActionResult {
  for (const [marker, key] of [
    ["schedule_exists", "scheduleExists"],
    ["schedule_has_results", "scheduleHasResults"],
    ["team_not_in_division", "teamNotInDivision"],
    ["published_season_required", "seasonNotPublished"],
    ["game_locked", "gameLocked"],
    ["bracket_game_locked", "gameLocked"],
    ["game_not_found", "gameNotFound"],
    ["game_not_open", "gameNotOpen"],
  ] as const)
    if (error.message.includes(marker)) return { error: key };
  if (error.code === "42501") return { error: "notAllowed" };
  if (["23503", "23514", "22P02", "22007"].includes(error.code ?? ""))
    return { error: "invalidForm" };
  return { error: "saveFailed" };
}

function refresh(slug: string) {
  revalidatePath(`/admin/${slug}`, "layout");
  revalidatePath(`/${slug}`, "layout");
}

export async function generateSchedule(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = scheduleSetupSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const setup = parsed.data;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  // Same team order the wizard previewed, so the saved schedule matches it.
  const { data: teams, error: teamError } = await supabase
    .from("season_teams")
    .select("id")
    .eq("league_id", league.id)
    .eq("division_id", setup.divisionId)
    .eq("status", "approved")
    .order("team_name")
    .order("id");
  if (teamError) return { error: "saveFailed" };
  const schedule = buildSchedule(
    teams.map((team) => team.id),
    setup.twice,
    setup,
  );
  if ("error" in schedule) return { error: schedule.error };
  const { data, error } = await supabase.rpc("save_division_schedule", {
    p_league_id: league.id,
    p_division_id: setup.divisionId,
    p_games: schedule.games.map((game) => ({
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      round: game.round,
      scheduledAt: game.scheduledAt,
      venue: game.venue,
    })),
    p_replace: setup.replace,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true, count: data };
}

export async function updateGame(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = gameUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const { error } = await supabase.rpc("update_game", {
    p_league_id: league.id,
    p_game_id: parsed.data.gameId,
    // Generated types mark every SQL argument non-null; update_game accepts
    // null so a postponed game can wait for a new date.
    p_scheduled_at: parsed.data.scheduledAt as string,
    p_venue: parsed.data.venue,
    p_status: parsed.data.status,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}

export async function addGame(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = addGameSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const { error } = await supabase.rpc("add_game", {
    p_league_id: league.id,
    p_division_id: parsed.data.divisionId,
    p_home_season_team_id: parsed.data.homeTeamId,
    p_away_season_team_id: parsed.data.awayTeamId,
    p_scheduled_at: parsed.data.scheduledAt,
    p_venue: parsed.data.venue,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}

/** A new 6-digit PIN for the scorer's device; shown once, stored hashed. */
export async function createScorerPin(
  slug: string,
  gameId: string,
): Promise<ScheduleActionResult> {
  if (!z.uuid().safeParse(gameId).success) return { error: "invalidForm" };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const { data, error } = await supabase.rpc("create_scorer_pin", {
    p_league_id: league.id,
    p_game_id: gameId,
  });
  if (error) return failure(error);
  return { success: true, pin: data };
}
