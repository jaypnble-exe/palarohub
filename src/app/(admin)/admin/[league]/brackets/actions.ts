"use server";
import { revalidatePath } from "next/cache";
import { getLeagueAccess } from "@/lib/league-access";
import { bracketSetupSchema } from "@/lib/validation/brackets";

export async function createBracket(
  slug: string,
  input: unknown,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = bracketSetupSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidSeeds" };
  const { supabase, league, canManage } = await getLeagueAccess(slug);
  if (!canManage) return { error: "notAllowed" };
  const { error } = await supabase.rpc("create_bracket", {
    p_league_id: league.id,
    p_division_id: parsed.data.divisionId,
    p_preset: parsed.data.preset,
    p_team_ids: parsed.data.teamIds,
  });
  if (error) {
    if (error.message.includes("bracket_exists"))
      return { error: "bracketExists" };
    if (error.message.includes("regular_games_pending"))
      return { error: "gamesPending" };
    if (error.message.includes("invalid_bracket_seeds"))
      return { error: "invalidSeeds" };
    return { error: "saveFailed" };
  }
  revalidatePath(`/admin/${slug}`, "layout");
  revalidatePath(`/${slug}`, "layout");
  return { success: true };
}
