"use server";

import { redirect } from "next/navigation";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig, hasSupabaseConfig } from "@/lib/supabase/env";
import {
  readSavedAccounts,
  rememberCurrentAccount,
  writeSavedAccounts,
} from "@/lib/saved-accounts";

export type SwitchResult = { error: "expired" | "unavailable" | "notFound" };

/**
 * Signs in as another account saved on this device, keeping the current one
 * so it can be switched back to. No password: the saved session is resumed.
 */
export async function switchAccount(userId: unknown): Promise<SwitchResult> {
  const id = z.uuid().safeParse(userId);
  if (!id.success) return { error: "notFound" };
  if (!hasSupabaseConfig()) return { error: "unavailable" };
  const supabase = await createClient();
  const saved = await readSavedAccounts();
  const target = saved.find((account) => account.id === id.data);
  if (!target) return { error: "notFound" };
  const accounts = await rememberCurrentAccount(supabase, saved);
  // Resume the saved session on a client that stores nothing, so a session
  // that has ended cannot sign the current account out.
  const { url, key } = getSupabaseConfig();
  const probe = createStatelessClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await probe.auth.refreshSession({
    refresh_token: target.refreshToken,
  });
  if (error || !data.session || data.user?.id !== target.id) {
    // Signed out elsewhere or expired: they need the password again.
    await writeSavedAccounts(
      accounts.filter((account) => account.id !== target.id),
    );
    return { error: "expired" };
  }
  const resumed = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (resumed.error) {
    await writeSavedAccounts(accounts);
    return { error: "expired" };
  }
  // The account is now the signed-in one; its token lives in the auth cookies.
  await writeSavedAccounts(
    accounts.filter((account) => account.id !== target.id),
  );
  redirect("/leagues");
}

/** Keeps the current account on this device, then opens sign-in for another. */
export async function addAccount() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    await writeSavedAccounts(
      await rememberCurrentAccount(supabase, await readSavedAccounts()),
    );
  }
  redirect("/login?add=1");
}

/** Removes a saved account from this device. */
export async function forgetAccount(userId: unknown) {
  const id = z.uuid().safeParse(userId);
  if (!id.success) return;
  const saved = await readSavedAccounts();
  await writeSavedAccounts(saved.filter((account) => account.id !== id.data));
}
