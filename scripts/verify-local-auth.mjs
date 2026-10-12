import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Real local Auth + callback HTTP check. Creates and removes one temporary user.
// It deliberately never prints email links, PKCE values, sessions, or API keys.
process.loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const inboxUrl = "http://127.0.0.1:55324";
for (const url of [apiUrl, siteUrl, inboxUrl]) {
  if (
    !url ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
  )
    throw new Error("This check only supports local services.");
}
const anonymousKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!anonymousKey || !serviceKey)
  throw new Error("Local credentials are missing.");
const cookies = new Map();
const auth = createServerClient(apiUrl, anonymousKey, {
  cookies: {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll: (values) =>
      values.forEach(({ name, value }) => cookies.set(name, value)),
  },
});
const service = createClient(apiUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = `phase1-check-${randomUUID()}@example.test`;
let userId;

function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}
async function page(path, signedIn = true) {
  return fetch(new URL(path, siteUrl), {
    redirect: "manual",
    headers: signedIn ? { Cookie: cookieHeader() } : {},
  });
}

try {
  const callback = new URL("/auth/callback", siteUrl);
  callback.searchParams.set("next", "/leagues");
  const { error } = await auth.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString() },
  });
  assert.equal(error, null, "local magic link must be sent");
  const { data: users, error: userError } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  assert.equal(userError, null);
  userId = users.users.find((user) => user.email === email)?.id;
  assert.ok(userId, "signup must create a user");

  let message;
  for (let attempt = 0; attempt < 20; attempt++) {
    const inbox = await (await fetch(`${inboxUrl}/api/v1/messages`)).json();
    message = inbox.messages?.find((item) =>
      item.To?.some((recipient) => recipient.Address === email),
    );
    if (message) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(message, "local inbox must receive a sign-in link");
  const content = await (
    await fetch(`${inboxUrl}/api/v1/message/${message.ID}`)
  ).json();
  const link = content.HTML.match(/href="([^"]+)"/i)?.[1]?.replaceAll(
    "&amp;",
    "&",
  );
  assert.ok(link, "email must contain a link");
  assert.equal(new URL(link).origin, new URL(apiUrl).origin);
  const verification = await fetch(link, { redirect: "manual" });
  const destination = verification.headers.get("location");
  assert.ok(destination, "Auth must redirect to the application callback");
  assert.equal(new URL(destination).origin, new URL(siteUrl).origin);
  assert.equal(new URL(destination).pathname, "/auth/callback");
  const callbackResponse = await fetch(destination, {
    redirect: "manual",
    headers: { Cookie: cookieHeader() },
  });
  for (const cookie of callbackResponse.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0];
    const separator = pair.indexOf("=");
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  assert.equal(
    new URL(callbackResponse.headers.get("location"), siteUrl).pathname,
    "/leagues",
  );

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .single();
  assert.equal(profileError, null);
  assert.equal(
    profile.is_platform_admin,
    false,
    "signup profile starts without admin rights",
  );
  const signedInPage = await page("/leagues");
  assert.equal(signedInPage.status, 200);
  assert.match(await signedInPage.text(), /You have not joined a league yet/);
  const forbiddenPage = await page("/admin/sindikato");
  assert.equal(forbiddenPage.status, 200);
  assert.match(await forbiddenPage.text(), /You do not have access/);
  const anonymousAdmin = await page("/admin/sindikato", false);
  assert.equal(anonymousAdmin.status, 307);
  assert.equal(
    new URL(anonymousAdmin.headers.get("location"), siteUrl).pathname,
    "/login",
  );
  const anonymousTeam = await page("/team/sindikato", false);
  assert.equal(anonymousTeam.status, 307);

  const { data: demo, error: demoError } = await service
    .from("leagues")
    .select("id")
    .eq("slug", "sindikato")
    .single();
  assert.equal(demoError, null);
  const { error: membershipError } = await service
    .from("league_members")
    .insert({ league_id: demo.id, user_id: userId, role: "commissioner" });
  assert.equal(membershipError, null);
  const leagueList = await page("/leagues");
  assert.match(await leagueList.text(), /Sindikato/);
  const adminPage = await page("/admin/sindikato");
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /1 team waiting for review/);
  for (const path of [
    "/admin/sindikato/teams",
    "/admin/sindikato/players",
    "/admin/sindikato/registrations",
    "/admin/sindikato/registrations/b0000000-0000-4000-8000-000000000002",
    "/team/sindikato/registrations/b0000000-0000-4000-8000-000000000003",
    "/admin/sindikato/seasons/50000000-0000-4000-8000-000000000001/registration",
  ]) {
    const response = await page(path);
    assert.equal(response.status, 200, `${path} must render`);
    assert.doesNotMatch(
      await response.text(),
      /Something went wrong|MISSING_MESSAGE/,
    );
  }
  const publicPage = await page("/sindikato", false);
  assert.equal(publicPage.status, 200);
  assert.match(await publicPage.text(), /Sindikato/);
  const registrationPage = await page(
    "/sindikato/register/50000000-0000-4000-8000-000000000001",
    false,
  );
  assert.equal(registrationPage.status, 200);
  assert.match(await registrationPage.text(), /Sign in to register a team/);
  console.log(
    "Local email link, signup trigger, callback cookies, My leagues, role protection, and Sindikato HTTP checks passed.",
  );
} finally {
  if (userId) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;
    console.log("Temporary verification user and its memberships removed.");
  }
}
