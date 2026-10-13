"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getAuth, getSiteUrl } from "@/lib/auth";
import { isGoogleEnabled } from "@/lib/auth-settings";
import {
  emailSchema,
  newPasswordSchema,
  safeNextPath,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

/** Where email links (account confirmation, password reset) bring people back to. */
function callbackUrl(next: string) {
  const callback = new URL("/auth/callback", getSiteUrl());
  callback.searchParams.set("next", safeNextPath(next));
  return callback.toString();
}

/** Plain-language result keys for the sign-in screen. */
export type AuthResult =
  | {
      success: true;
      message?: "confirmEmail" | "resetSent";
      /** Where to go now that the person is signed in. */
      redirectTo?: string;
    }
  | {
      error:
        | "invalidEmail"
        | "invalidForm"
        | "unavailable"
        | "wrongPassword"
        | "emailNotConfirmed"
        | "accountExists"
        | "weakPassword"
        | "tooManyRequests"
        | "signInFailed";
    };

function authError(error: { status?: number; code?: string }): AuthResult {
  if (error.status === 429) return { error: "tooManyRequests" };
  if (error.code === "invalid_credentials") return { error: "wrongPassword" };
  if (error.code === "email_not_confirmed")
    return { error: "emailNotConfirmed" };
  if (error.code === "user_already_exists" || error.code === "email_exists")
    return { error: "accountExists" };
  if (error.code === "weak_password") return { error: "weakPassword" };
  return { error: "signInFailed" };
}

export async function signInWithPassword(
  input: unknown,
  next: string,
): Promise<AuthResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  if (!hasSupabaseConfig()) return { error: "unavailable" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return authError(error);
  return { success: true, redirectTo: safeNextPath(next) };
}

/**
 * Creates an account. With email confirmation off in Supabase the person is
 * signed in straight away; otherwise they are asked to confirm once.
 */
export async function signUpWithPassword(
  input: unknown,
  next: string,
): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  if (!hasSupabaseConfig()) return { error: "unavailable" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: callbackUrl(next),
    },
  });
  if (error) return authError(error);
  // An existing address returns a user with no identities and no session.
  if (data.user && data.user.identities?.length === 0)
    return { error: "accountExists" };
  if (!data.session) return { success: true, message: "confirmEmail" };
  return { success: true, redirectTo: safeNextPath(next) };
}

/** Emails a link to choose a new password. Never reveals whether the account exists. */
export async function requestPasswordReset(
  input: unknown,
): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidEmail" };
  if (!hasSupabaseConfig()) return { error: "unavailable" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: callbackUrl("/leagues/password") },
  );
  if (error?.status === 429) return { error: "tooManyRequests" };
  return { success: true, message: "resetSent" };
}

/** Sets a new password for the signed-in person (also after a reset link). */
export async function updatePassword(input: unknown): Promise<AuthResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const auth = await getAuth();
  if (!auth) return { error: "signInFailed" };
  const { error } = await auth.supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return authError(error);
  return { success: true };
}

export async function signInWithGoogle(next: string) {
  if (!hasSupabaseConfig()) redirect("/login?error=unavailable");
  if (!(await isGoogleEnabled())) redirect("/login?error=googleFailed");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next), skipBrowserRedirect: true },
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
