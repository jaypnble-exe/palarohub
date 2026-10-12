import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("Usage: pnpm db:bootstrap your-email@example.com");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (
  !url ||
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
)
  throw new Error("Bootstrap is restricted to local Supabase.");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error("Local service role key is missing.");
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let user;
for (let page = 1; !user; page++) {
  const { data, error } = await client.auth.admin.listUsers({
    page,
    perPage: 100,
  });
  if (error) throw error;
  user = data.users.find((item) => item.email?.toLowerCase() === email);
  if (data.users.length < 100) break;
}
if (!user)
  throw new Error("Sign in with this email locally before running bootstrap.");
const { error: profileError } = await client
  .from("profiles")
  .update({ is_platform_admin: true })
  .eq("id", user.id);
if (profileError) throw profileError;
const { data: league, error: leagueError } = await client
  .from("leagues")
  .select("id")
  .eq("slug", "sindikato")
  .single();
if (leagueError) throw leagueError;
const { error: memberError } = await client
  .from("league_members")
  .upsert(
    { league_id: league.id, user_id: user.id, role: "commissioner" },
    { onConflict: "league_id,user_id,role" },
  );
if (memberError) throw memberError;
console.log("Granted local platform admin and Sindikato commissioner access.");
