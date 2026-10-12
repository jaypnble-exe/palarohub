import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { hasSupabaseConfig } from "./supabase/env";

export const getAuth = cache(async () => {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, user };
});

export async function requireUser(next = "/leagues") {
  const auth = await getAuth();
  if (!auth) redirect(`/login?next=${encodeURIComponent(next)}`);
  return auth;
}

export async function isPlatformAdmin() {
  const auth = await getAuth();
  if (!auth) return false;
  const { data, error } = await auth.supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", auth.user.id)
    .single();
  if (error) throw new Error("Unable to load profile.");
  return data.is_platform_admin;
}

export function getSiteUrl() {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV !== "production"
      ? "http://localhost:3000"
      : undefined);
  if (!value) throw new Error("Site URL is not configured.");
  return new URL(value).origin;
}
