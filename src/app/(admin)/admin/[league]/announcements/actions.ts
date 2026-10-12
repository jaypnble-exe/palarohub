"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueAccess } from "@/lib/league-access";
import {
  announcementSchema,
  type ScheduleActionResult,
} from "@/lib/validation/schedule";

function refresh(slug: string) {
  revalidatePath(`/admin/${slug}`, "layout");
  revalidatePath(`/${slug}`, "layout");
}

export async function postAnnouncement(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, user, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  let seasonId: string | null = null;
  if (parsed.data.divisionId) {
    const { data: division, error } = await supabase
      .from("divisions")
      .select("season_id")
      .eq("league_id", league.id)
      .eq("id", parsed.data.divisionId)
      .maybeSingle();
    if (error) return { error: "saveFailed" };
    if (!division) return { error: "invalidForm" };
    seasonId = division.season_id;
  }
  const { error } = await supabase.from("announcements").insert({
    league_id: league.id,
    season_id: seasonId,
    division_id: parsed.data.divisionId,
    title: parsed.data.title,
    body: parsed.data.body,
    created_by: user.id,
  });
  if (error)
    return { error: error.code === "42501" ? "notAllowed" : "saveFailed" };
  refresh(slug);
  return { success: true };
}

export async function deleteAnnouncement(
  slug: string,
  announcementId: string,
): Promise<ScheduleActionResult> {
  if (!z.uuid().safeParse(announcementId).success)
    return { error: "invalidForm" };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const { error, count } = await supabase
    .from("announcements")
    .delete({ count: "exact" })
    .eq("league_id", league.id)
    .eq("id", announcementId);
  if (error || !count) return { error: "saveFailed" };
  refresh(slug);
  return { success: true };
}
