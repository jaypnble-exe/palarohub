import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import type { createClient } from "./supabase/server";
import { displayNameOf } from "./user-name";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Other accounts used on this device, so a person with several roles (or a
 * commissioner testing as a team manager) can switch without a password.
 * Only the refresh token is kept, in an httpOnly cookie that page scripts
 * cannot read. Nothing is stored for the account that is signed in now.
 */
const cookieName = "palaros-accounts";
const maxAccounts = 5;
const maxAgeSeconds = 30 * 24 * 60 * 60;

const savedAccountSchema = z.object({
  id: z.uuid(),
  email: z.string().max(320),
  name: z.string().max(200),
  refreshToken: z.string().min(1).max(2000),
});
export type SavedAccount = z.infer<typeof savedAccountSchema>;
/** What the screens may see: never the token. */
export type AccountChoice = Omit<SavedAccount, "refreshToken">;

export async function readSavedAccounts(): Promise<SavedAccount[]> {
  const raw = (await cookies()).get(cookieName)?.value;
  if (!raw) return [];
  try {
    const parsed = z
      .array(savedAccountSchema)
      .safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? parsed.data.slice(0, maxAccounts) : [];
  } catch {
    return [];
  }
}

/** Saved accounts without their tokens, leaving out the one signed in now. */
export async function accountChoices(
  currentUserId?: string,
): Promise<AccountChoice[]> {
  return (await readSavedAccounts())
    .filter((account) => account.id !== currentUserId)
    .map(({ id, email, name }) => ({ id, email, name }));
}

/** Only works where cookies can be written: Server Actions and route handlers. */
export async function writeSavedAccounts(accounts: readonly SavedAccount[]) {
  const store = await cookies();
  if (!accounts.length) {
    store.delete(cookieName);
    return;
  }
  store.set(
    cookieName,
    Buffer.from(JSON.stringify(accounts.slice(0, maxAccounts))).toString(
      "base64url",
    ),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
    },
  );
}

/**
 * Keeps the signed-in account so it can be switched back to later. Scorer
 * devices (anonymous sessions) are never saved.
 */
export async function rememberCurrentAccount(
  supabase: Client,
  accounts: SavedAccount[],
): Promise<SavedAccount[]> {
  const [{ data: user }, { data: session }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  const current = user.user;
  const refreshToken = session.session?.refresh_token;
  if (
    !current ||
    current.is_anonymous ||
    !refreshToken ||
    session.session?.user.id !== current.id
  )
    return accounts;
  return [
    {
      id: current.id,
      email: current.email ?? "",
      name: displayNameOf(current),
      refreshToken,
    },
    ...accounts.filter((account) => account.id !== current.id),
  ];
}

/** After a sign-in, the new account is the current one, not a saved one. */
export async function forgetSavedAccount(userId: string) {
  const accounts = await readSavedAccounts();
  if (accounts.some((account) => account.id === userId))
    await writeSavedAccounts(
      accounts.filter((account) => account.id !== userId),
    );
}
