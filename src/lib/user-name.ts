import type { User } from "@supabase/supabase-js";

/** The name a person signed up with, or the start of their email. */
export function displayNameOf(user: Pick<User, "email" | "user_metadata">) {
  const metadata = user.user_metadata as
    { full_name?: unknown; name?: unknown } | undefined;
  const name = [metadata?.full_name, metadata?.name].find(
    (value): value is string => typeof value === "string" && !!value.trim(),
  );
  return name?.trim() ?? user.email?.split("@")[0] ?? "";
}
