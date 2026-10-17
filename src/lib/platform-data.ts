import "server-only";
import { z } from "zod";
import type { createClient } from "./supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

const overviewSchema = z.object({
  leagues: z.number(),
  pausedLeagues: z.number(),
  teams: z.number(),
  players: z.number(),
  users: z.number(),
  gamesThisWeek: z.number(),
  gamesLive: z.number(),
  gamesWaiting: z.number(),
});
export type PlatformOverview = z.infer<typeof overviewSchema>;

const personSchema = z.object({
  userId: z.string(),
  email: z.string().nullable(),
  name: z.string(),
});
const membershipSchema = z.object({
  leagueId: z.string(),
  slug: z.string(),
  league: z.string(),
  role: z.enum(["commissioner", "league_staff", "team_manager"]),
});
const managedTeamSchema = z.object({ team: z.string(), league: z.string() });

export async function platformOverview(supabase: Client) {
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) throw new Error("Unable to load the platform overview.");
  return overviewSchema.parse(data);
}

export async function platformLeagues(supabase: Client) {
  const { data, error } = await supabase.rpc("admin_leagues");
  if (error) throw new Error("Unable to load leagues.");
  return (data ?? []).map((league) => ({
    ...league,
    commissioners: z.array(personSchema).parse(league.commissioners),
  }));
}
export type PlatformLeague = Awaited<
  ReturnType<typeof platformLeagues>
>[number];

export async function platformLeague(supabase: Client, slug: string) {
  const leagues = await platformLeagues(supabase);
  const league = leagues.find((item) => item.slug === slug);
  if (!league) return null;
  const [members, log] = await Promise.all([
    supabase.rpc("admin_league_members", { p_league_id: league.id }),
    supabase.rpc("admin_league_log", { p_league_id: league.id }),
  ]);
  if (members.error || log.error)
    throw new Error("Unable to load league members.");
  return { league, members: members.data ?? [], log: log.data ?? [] };
}

export async function findUsers(supabase: Client, query: string) {
  const { data, error } = await supabase.rpc("admin_find_users", {
    p_query: query,
  });
  if (error) throw new Error("Unable to search users.");
  return (data ?? []).map((user) => ({
    ...user,
    memberships: z.array(membershipSchema).parse(user.memberships),
    managed_teams: z.array(managedTeamSchema).parse(user.managed_teams),
  }));
}
