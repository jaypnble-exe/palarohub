"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueAccess } from "@/lib/league-access";
import {
  teamSchema,
  playerSchema,
  registrationSchema,
  registrationSettingsSchema,
  reviewSchema,
  ratingEntrySchema,
  playerChecksSchema,
  rosterChangeSchema,
  eligibilityIssueSchema,
  type RegistrationActionResult,
} from "@/lib/validation/registration";

function failure(error: {
  message: string;
  code?: string;
  details?: string;
}): RegistrationActionResult {
  if (error.message.includes("team_logo_required"))
    return { error: "teamLogoRequired" };
  if (error.message.includes("invalid_team_media"))
    return { error: "invalidTeamMedia" };
  if (error.message.includes("roster_ineligible")) {
    let issues: RegistrationActionResult["issues"];
    try {
      const parsed = z
        .array(eligibilityIssueSchema)
        .safeParse(JSON.parse(error.details ?? "null"));
      if (parsed.success) issues = parsed.data;
    } catch {
      /* A malformed database detail must never become UI content. */
    }
    return { error: "rosterIneligible", issues };
  }
  if (error.message.includes("registration_closed"))
    return { error: "registrationClosed" };
  if (error.message.includes("deadline_passed"))
    return { error: "deadlinePassed" };
  if (error.message.includes("registration_not_submitted"))
    return { error: "notWaitingForReview" };
  if (
    error.message.includes("registration_locked") ||
    error.message.includes("request_not_submitted")
  )
    return { error: "registrationLocked" };
  if (error.message.includes("review_comment_required"))
    return { error: "commentRequired" };
  if (error.message.includes("required") && error.code === "42501")
    return { error: "notAllowed" };
  if (error.code === "23505") {
    if (error.message.includes("teams_league_name_idx"))
      return { error: "teamNameTaken" };
    if (error.message.includes("roster_one_pending_request_idx"))
      return { error: "changeAlreadyPending" };
    if (error.message.includes("roster_one_team_per_division_idx"))
      return { error: "playerAlreadyRegistered" };
    if (error.message.includes("roster_unique_jersey_idx"))
      return { error: "duplicateJersey" };
    if (error.message.includes("season_teams_team_division_key"))
      return { error: "teamAlreadyRegistered" };
  }
  if (
    error.code === "23503" ||
    error.code === "23514" ||
    error.code === "22P02"
  )
    return { error: "invalidForm" };
  return { error: "saveFailed" };
}
function refresh(slug: string) {
  revalidatePath(`/admin/${slug}`, "layout");
  revalidatePath(`/team/${slug}`, "layout");
  revalidatePath(`/${slug}`);
}
function validId(value: unknown) {
  return z.uuid().safeParse(value).success;
}

export async function joinRegistration(
  slug: string,
  seasonId: string,
): Promise<RegistrationActionResult> {
  if (!validId(seasonId)) return { error: "invalidForm" };
  const { supabase, league } = await getLeagueAccess(slug, "team");
  const { error } = await supabase.rpc("join_league_registration", {
    p_league_id: league.id,
    p_season_id: seasonId,
  });
  if (error) return failure(error);
  refresh(slug);
  revalidatePath("/leagues");
  return { success: true };
}
export async function createTeam(
  slug: string,
  input: unknown,
): Promise<RegistrationActionResult> {
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canRegister } = await getLeagueAccess(slug, "team");
  if (!canRegister) return { error: "notAllowed" };
  const { data, error } = await supabase.rpc("create_registration_team", {
    p_league_id: league.id,
    p_name: parsed.data.name,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true, id: data };
}
export async function createPlayer(
  slug: string,
  input: unknown,
): Promise<RegistrationActionResult> {
  const parsed = playerSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canRegister, canView } = await getLeagueAccess(
    slug,
    "team",
  );
  if (!canRegister && !canView) return { error: "notAllowed" };
  const { data, error } = await supabase.rpc("create_registration_player", {
    p_league_id: league.id,
    p_name: parsed.data.name,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true, id: data };
}
export async function saveRegistration(
  slug: string,
  registrationId: string | null,
  input: unknown,
  submit: boolean,
): Promise<RegistrationActionResult> {
  const parsed = registrationSchema.safeParse(input);
  if (
    !parsed.success ||
    typeof submit !== "boolean" ||
    (registrationId && !validId(registrationId))
  )
    return { error: "invalidForm" };
  const { supabase, league, canRegister } = await getLeagueAccess(slug, "team");
  if (!canRegister) return { error: "notAllowed" };
  const { data, error } = await supabase.rpc("save_team_registration", {
    p_league_id: league.id,
    p_setup: parsed.data,
    p_submit: submit,
    p_registration_id: registrationId ?? undefined,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true, id: data };
}
/** Takes a registration still waiting for review back to a draft, to edit it. */
export async function withdrawRegistration(
  slug: string,
  registrationId: string,
): Promise<RegistrationActionResult> {
  if (!validId(registrationId)) return { error: "invalidForm" };
  const { supabase, league, canRegister } = await getLeagueAccess(slug, "team");
  if (!canRegister) return { error: "notAllowed" };
  const { error } = await supabase.rpc("withdraw_team_registration", {
    p_league_id: league.id,
    p_registration_id: registrationId,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true, id: registrationId };
}
export async function configureRegistration(
  slug: string,
  input: unknown,
): Promise<RegistrationActionResult> {
  const parsed = registrationSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canManage } = await getLeagueAccess(slug);
  if (!canManage) return { error: "notAllowed" };
  const setup = parsed.data;
  const { error } = await supabase.rpc("set_registration_settings", {
    p_league_id: league.id,
    p_season_id: setup.seasonId,
    p_is_open: setup.isOpen,
    p_deadline: setup.deadline,
    p_fee_halalas: setup.feeHalalas,
    p_require_documents: setup.requireDocuments,
  });
  if (error) return failure(error);
  refresh(slug);
  revalidatePath(`/${slug}/register/${setup.seasonId}`);
  return { success: true };
}
export async function reviewRegistration(
  slug: string,
  input: unknown,
): Promise<RegistrationActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: "commentRequired" };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const { error } = await supabase.rpc("review_team_registration", {
    p_league_id: league.id,
    p_registration_id: parsed.data.registrationId,
    p_decision: parsed.data.decision,
    p_comment: parsed.data.comment,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}
export async function addPlayerRating(
  slug: string,
  input: unknown,
): Promise<RegistrationActionResult> {
  const parsed = ratingEntrySchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canManage } = await getLeagueAccess(slug);
  if (!canManage) return { error: "notAllowed" };
  const { data, error } = await supabase.rpc("add_player_rating", {
    p_league_id: league.id,
    p_player_id: parsed.data.playerId,
    p_rating: parsed.data.rating,
    p_effective_from: parsed.data.effectiveFrom,
    p_reason: parsed.data.reason,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true, id: data };
}
export async function updatePlayerChecks(
  slug: string,
  input: unknown,
): Promise<RegistrationActionResult> {
  const parsed = playerChecksSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const { error } = await supabase.rpc("set_player_checks", {
    p_league_id: league.id,
    p_player_id: parsed.data.playerId,
    p_documents_present: parsed.data.documentsPresent,
    p_suspended: parsed.data.suspended,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}
export async function requestRosterChange(
  slug: string,
  input: unknown,
): Promise<RegistrationActionResult> {
  const parsed = rosterChangeSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canRegister } = await getLeagueAccess(slug, "team");
  if (!canRegister) return { error: "notAllowed" };
  const { data, error } = await supabase.rpc("request_roster_change", {
    p_league_id: league.id,
    p_registration_id: parsed.data.registrationId,
    p_roster: parsed.data.roster,
    p_reason: parsed.data.reason,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true, id: data };
}
export async function reviewRosterChange(
  slug: string,
  requestId: string,
  approve: boolean,
  comment: string,
): Promise<RegistrationActionResult> {
  if (
    !validId(requestId) ||
    typeof approve !== "boolean" ||
    typeof comment !== "string" ||
    comment.length > 1000 ||
    (!approve && !comment.trim())
  )
    return { error: "commentRequired" };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const { error } = await supabase.rpc("review_roster_change", {
    p_league_id: league.id,
    p_request_id: requestId,
    p_approve: approve,
    p_comment: comment.trim(),
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}
