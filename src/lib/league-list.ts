import type { Database } from "./supabase/database.types";

export type LeagueRole = Database["public"]["Enums"]["league_role"];
export interface MyLeague {
  id: string;
  name: string;
  slug: string;
  sport: string;
  roles: LeagueRole[];
}
export interface Workspace {
  kind: "admin" | "team";
  href: string;
}

const roleOrder: LeagueRole[] = [
  "commissioner",
  "league_staff",
  "team_manager",
];

/** One entry per league, with every role the person holds there. */
export function groupMemberships(
  rows: readonly {
    role: LeagueRole;
    leagues: { id: string; name: string; slug: string; sport: string } | null;
  }[],
): MyLeague[] {
  const leagues = new Map<string, MyLeague>();
  for (const row of rows) {
    if (!row.leagues) continue;
    const league = leagues.get(row.leagues.id) ?? { ...row.leagues, roles: [] };
    if (!league.roles.includes(row.role)) league.roles.push(row.role);
    leagues.set(league.id, league);
  }
  return [...leagues.values()]
    .map((league) => ({
      ...league,
      roles: [...league.roles].sort(
        (a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The areas a person can open in a league: the dashboard, their team, or both. */
export function workspacesFor(league: Pick<MyLeague, "slug" | "roles">) {
  const workspaces: Workspace[] = [];
  if (
    league.roles.some(
      (role) => role === "commissioner" || role === "league_staff",
    )
  )
    workspaces.push({ kind: "admin", href: `/admin/${league.slug}` });
  if (league.roles.includes("team_manager"))
    workspaces.push({ kind: "team", href: `/team/${league.slug}` });
  return workspaces;
}
