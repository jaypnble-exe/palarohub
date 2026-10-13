import "server-only";
import { z } from "zod";
import { getSupabaseConfig, hasSupabaseConfig } from "./supabase/env";

/** Whether Google sign-in is switched on in Supabase, so the button only shows when it works. */
export async function isGoogleEnabled() {
  if (!hasSupabaseConfig()) return false;
  const { url, key } = getSupabaseConfig();
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
    });
    const settings = z
      .object({ external: z.object({ google: z.boolean() }) })
      .safeParse(await response.json());
    return response.ok && settings.success && settings.data.external.google;
  } catch {
    return false;
  }
}
