"use server";

import { revalidatePath } from "next/cache";
import { requireUser, isPlatformAdmin } from "@/lib/auth";
import { leagueSchema } from "@/lib/validation/leagues";

export async function createLeague(input: unknown) {
  const { supabase } = await requireUser("/admin");
  if (!(await isPlatformAdmin())) return { error: "notAllowed" as const };
  const parsed = leagueSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" as const };
  const { name, slug, sport, commissionerEmail } = parsed.data;
  const { error } = await supabase.rpc("create_league_with_commissioner", {
    league_name: name,
    league_slug: slug,
    league_sport: sport,
    commissioner_email: commissionerEmail,
  });
  if (error) {
    if (error.code === "23505") return { error: "slugTaken" as const };
    if (error.message === "commissioner_not_found")
      return { error: "commissionerNotFound" as const };
    return { error: "createFailed" as const };
  }
  revalidatePath("/leagues");
  revalidatePath(`/${slug}`);
  return { slug };
}
