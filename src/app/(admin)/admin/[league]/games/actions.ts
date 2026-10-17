"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueAccess } from "@/lib/league-access";
import { loadGameRecord } from "@/lib/game-record";
import { getSportModule } from "@/lib/sports/registry";
import type { ScheduleActionResult } from "@/lib/validation/schedule";

const approvalSchema = z
  .strictObject({
    gameId: z.uuid(),
    suspend: z.array(z.uuid()).max(30),
    /** Games each suspended player misses, in the same order (default 1). */
    suspendGames: z.array(z.number().int().min(1).max(20)).max(30).optional(),
    playerOfGame: z.uuid().nullable(),
  })
  .refine(
    (input) =>
      !input.suspendGames || input.suspendGames.length === input.suspend.length,
  );
const forfeitSchema = z
  .strictObject({
    gameId: z.uuid(),
    kind: z.enum(["forfeit", "default"]),
    side: z.enum(["home", "away", "both"]),
    reason: z.string().trim().min(1).max(1000),
  })
  .refine((input) => input.side !== "both" || input.kind === "forfeit");
const correctionSchema = z.strictObject({
  gameId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
});
const reopenSchema = z.strictObject({
  gameId: z.uuid(),
  comment: z.string().trim().min(1).max(1000),
});

function failure(error: {
  message: string;
  code?: string;
}): ScheduleActionResult {
  for (const [marker, key] of [
    ["game_not_submitted", "notSubmitted"],
    ["events_changed", "eventsChanged"],
    ["player_not_in_game", "invalidForm"],
    ["invalid_player_of_game", "invalidForm"],
    ["review_comment_required", "commentRequired"],
    ["game_not_found", "gameNotFound"],
    ["game_not_open", "gameNotOpen"],
    ["invalid_forfeit", "invalidForm"],
    ["game_not_approved", "notApproved"],
    ["bracket_result_locked", "bracketLocked"],
    ["season_closed", "seasonClosed"],
    ["commissioner_required", "commissionerOnly"],
  ] as const)
    if (error.message.includes(marker)) return { error: key };
  if (error.code === "42501") return { error: "notAllowed" };
  return { error: "saveFailed" };
}

function refresh(slug: string) {
  revalidatePath(`/admin/${slug}`, "layout");
  revalidatePath(`/${slug}`, "layout");
}

/**
 * Approves a submitted game. The result is derived again here from the event
 * log by the sport module; the client chooses suspensions and the game award.
 */
export async function approveGame(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = approvalSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const record = await loadGameRecord(supabase, parsed.data.gameId);
  if (!record || record.game.leagueId !== league.id)
    return { error: "gameNotFound" };
  if (record.game.status !== "submitted") return { error: "notSubmitted" };
  if (!record.summary) return { error: "notFinished" };
  if (record.unreadableEvents) return { error: "invalidForm" };
  const candidates = getSportModule(record.sport).playerOfGameCandidates(
    record.state,
  );
  if (candidates.length > 0 && !canManage) return { error: "notAllowed" };
  if (parsed.data.playerOfGame && !canManage) return { error: "notAllowed" };
  if (
    (canManage && candidates.length > 0 && !parsed.data.playerOfGame) ||
    (parsed.data.playerOfGame &&
      !candidates.some(
        (player) => player.playerId === parsed.data.playerOfGame,
      ))
  )
    return { error: "invalidForm" };
  const ejected = new Set(
    record.summary.ejectedPlayers.map((player) => player.playerId),
  );
  if (
    parsed.data.suspend.some((id) => !ejected.has(id)) ||
    new Set(parsed.data.suspend).size !== parsed.data.suspend.length
  )
    return { error: "invalidForm" };
  const { error } = await supabase.rpc("approve_game_with_player", {
    p_league_id: league.id,
    p_game_id: record.game.id,
    p_last_sequence: record.lastSequence,
    p_home_score: record.summary.homeScore,
    p_away_score: record.summary.awayScore,
    p_summary: JSON.parse(JSON.stringify(record.summary.summary)),
    p_suspend_player_ids: parsed.data.suspend,
    p_suspend_games: parsed.data.suspendGames ?? [],
    p_player_id: parsed.data.playerOfGame ?? undefined,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}

/** Sends a submitted game back to the scorer with the reason. */
export async function reopenGame(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = reopenSchema.safeParse(input);
  if (!parsed.success) return { error: "commentRequired" };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const { error } = await supabase.rpc("reopen_game", {
    p_league_id: league.id,
    p_game_id: parsed.data.gameId,
    p_comment: parsed.data.comment,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}

/**
 * Records a no-show (forfeit, 20-0) or a team running out of players
 * (default). For a default the score so far is worked out from the game.
 */
export async function recordForfeit(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = forfeitSchema.safeParse(input);
  if (!parsed.success)
    return {
      error:
        typeof input === "object" &&
        input &&
        "reason" in input &&
        !String((input as { reason: unknown }).reason).trim()
          ? "reasonRequired"
          : "invalidForm",
    };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const record = await loadGameRecord(supabase, parsed.data.gameId);
  if (!record || record.game.leagueId !== league.id)
    return { error: "gameNotFound" };
  const score =
    parsed.data.kind === "default"
      ? getSportModule(record.sport).liveScore(record.state, record.rules)
      : null;
  const { error } = await supabase.rpc("record_forfeit", {
    p_league_id: league.id,
    p_game_id: record.game.id,
    p_kind: parsed.data.kind,
    p_side: parsed.data.side,
    p_reason: parsed.data.reason,
    p_home_score: score?.homeScore ?? 0,
    p_away_score: score?.awayScore ?? 0,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}

/**
 * Reopens an approved result so it can be corrected. The database keeps the
 * replaced result in the game's history; standings follow automatically.
 */
export async function correctResult(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return { error: "reasonRequired" };
  const { supabase, league, canManage } = await getLeagueAccess(slug);
  if (!canManage) return { error: "commissionerOnly" };
  const { error } = await supabase.rpc("reopen_result", {
    p_league_id: league.id,
    p_game_id: parsed.data.gameId,
    p_reason: parsed.data.reason,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}
