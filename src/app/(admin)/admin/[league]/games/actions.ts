"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueAccess } from "@/lib/league-access";
import { loadGameRecord } from "@/lib/game-record";
import { getSportModule } from "@/lib/sports/registry";
import type { ScheduleActionResult } from "@/lib/validation/schedule";

const approvalSchema = z.strictObject({
  gameId: z.uuid(),
  suspend: z.array(z.uuid()).max(30),
  playerOfGame: z.uuid().nullable(),
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
  if (parsed.data.suspend.some((id) => !ejected.has(id)))
    return { error: "invalidForm" };
  const { error } = await supabase.rpc("approve_game_with_player", {
    p_league_id: league.id,
    p_game_id: record.game.id,
    p_last_sequence: record.lastSequence,
    p_home_score: record.summary.homeScore,
    p_away_score: record.summary.awayScore,
    p_summary: JSON.parse(JSON.stringify(record.summary.summary)),
    p_suspend_player_ids: [...new Set(parsed.data.suspend)],
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
