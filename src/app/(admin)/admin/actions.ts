"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

export type PlatformActionResult = { success?: true; error?: string };

const memberSchema = z.object({
  leagueId: z.uuid(),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(["commissioner", "league_staff"]),
});
const removeSchema = z.object({
  leagueId: z.uuid(),
  userId: z.uuid(),
  role: z.enum(["commissioner", "league_staff", "team_manager"]),
});
const replaceSchema = z.object({
  leagueId: z.uuid(),
  email: z.string().trim().toLowerCase().pipe(z.email()),
});
const pauseSchema = z
  .object({
    leagueId: z.uuid(),
    paused: z.boolean(),
    reason: z.string().trim().max(500).default(""),
  })
  .refine((input) => !input.paused || input.reason.length > 0, {
    path: ["reason"],
  });

const platformErrors: Record<string, string> = {
  user_not_found: "userNotFound",
  last_commissioner: "lastCommissioner",
  member_not_found: "memberNotFound",
  league_not_found: "leagueNotFound",
  reason_required: "reasonRequired",
  platform_admin_required: "notAllowed",
};

async function platformMutation(
  run: (
    supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  ) => PromiseLike<{ error: { message: string } | null }>,
): Promise<PlatformActionResult> {
  const { supabase } = await requireUser("/admin");
  if (!(await isPlatformAdmin())) return { error: "notAllowed" };
  const { error } = await run(supabase);
  if (error) {
    const key = Object.keys(platformErrors).find((code) =>
      error.message.includes(code),
    );
    return { error: key ? platformErrors[key] : "saveFailed" };
  }
  revalidatePath("/admin", "layout");
  return { success: true };
}

export async function addLeagueMember(
  input: unknown,
): Promise<PlatformActionResult> {
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidEmail" };
  const { leagueId, email, role } = parsed.data;
  return platformMutation((supabase) =>
    supabase.rpc("admin_add_member", {
      p_league_id: leagueId,
      p_email: email,
      p_role: role,
    }),
  );
}

export async function removeLeagueMember(
  input: unknown,
): Promise<PlatformActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { error: "saveFailed" };
  const { leagueId, userId, role } = parsed.data;
  return platformMutation((supabase) =>
    supabase.rpc("admin_remove_member", {
      p_league_id: leagueId,
      p_user_id: userId,
      p_role: role,
    }),
  );
}

export async function replaceCommissioner(
  input: unknown,
): Promise<PlatformActionResult> {
  const parsed = replaceSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidEmail" };
  const { leagueId, email } = parsed.data;
  return platformMutation((supabase) =>
    supabase.rpc("admin_replace_commissioner", {
      p_league_id: leagueId,
      p_email: email,
    }),
  );
}

export async function setLeaguePaused(
  input: unknown,
): Promise<PlatformActionResult> {
  const parsed = pauseSchema.safeParse(input);
  if (!parsed.success) return { error: "reasonRequired" };
  const { leagueId, paused, reason } = parsed.data;
  return platformMutation((supabase) =>
    supabase.rpc("admin_set_league_paused", {
      p_league_id: leagueId,
      p_paused: paused,
      p_reason: reason,
    }),
  );
}
