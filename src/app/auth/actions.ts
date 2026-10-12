"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { z } from "zod";
import { getSiteUrl } from "@/lib/auth";
import { emailSchema, safeNextPath } from "@/lib/validation/auth";

export async function sendMagicLink(input: unknown, next: string) {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidEmail" as const };
  if (!hasSupabaseConfig()) return { error: "unavailable" as const };
  const supabase = await createClient();
  const callback = new URL("/auth/callback", getSiteUrl());
  callback.searchParams.set("next", safeNextPath(next));
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callback.toString() },
  });
  if (error)
    return {
      error:
        error.status === 429
          ? ("tooManyRequests" as const)
          : ("sendFailed" as const),
    };
  return { success: true as const };
}

export async function signInWithGoogle(next: string) {
  if (!hasSupabaseConfig()) redirect("/login?error=unavailable");
  const { url, key } = getSupabaseConfig();
  let googleEnabled = false;
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    const settings = z
      .object({ external: z.object({ google: z.boolean() }) })
      .safeParse(await response.json());
    googleEnabled =
      response.ok && settings.success && settings.data.external.google;
  } catch {
    /* Report a translated login error below if Auth is unavailable. */
  }
  if (!googleEnabled) redirect("/login?error=googleFailed");
  const supabase = await createClient();
  const callback = new URL("/auth/callback", getSiteUrl());
  callback.searchParams.set("next", safeNextPath(next));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) redirect("/login?error=googleFailed");
  redirect(data.url);
}

export async function signOut() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) redirect("/leagues?error=signOutFailed");
  }
  redirect("/");
}
