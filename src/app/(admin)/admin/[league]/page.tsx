import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser, isPlatformAdmin } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
import { Dashboard } from "@/components/admin/dashboard";
import { scheduleOverview } from "@/lib/schedule-data";
import { seasonPayments } from "@/lib/payments-data";

export default async function CommissionerHome({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, user } = await requireUser(`/admin/${slug}`);
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id,name,slug,sport,settings")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Unable to load league.");
  if (!league) notFound();
  const { data: roles, error: roleError } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .in("role", ["commissioner", "league_staff"]);
  if (roleError) throw new Error("Unable to check league access.");
  const platformAdmin = await isPlatformAdmin();
  if (!roles?.length && !platformAdmin) return <AccessDenied />;
  const roleTranslations = await getTranslations("Roles");
  const role = roles?.some((membership) => membership.role === "commissioner")
    ? "commissioner"
    : roles?.some((membership) => membership.role === "league_staff")
      ? "league_staff"
      : "platform_admin";
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error("Unable to load profile.");
  const { data: memberships, error: memberError } = await supabase
    .from("league_members")
    .select("user_id,role,profiles(display_name)")
    .eq("league_id", league.id)
    .order("role");
  if (memberError) throw new Error("Unable to load league members.");
  const members = new Map<
    string,
    { id: string; name: string; roles: string[] }
  >();
  for (const membership of memberships ?? []) {
    const member = members.get(membership.user_id) ?? {
      id: membership.user_id,
      name: membership.profiles?.display_name.trim() ?? "",
      roles: [] as string[],
    };
    member.roles.push(roleTranslations(membership.role));
    members.set(membership.user_id, member);
  }
  const settings = league.settings;
  const { data: seasons, error: seasonError } = await supabase
    .from("seasons")
    .select("id,name,status,start_date,end_date,divisions(name,max_rating)")
    .eq("league_id", league.id)
    .order("start_date", { ascending: false })
    .limit(2);
  if (seasonError) throw new Error("Unable to load seasons.");
  const counts = await Promise.all([
    supabase
      .from("season_teams")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league.id)
      .eq("status", "submitted"),
    supabase
      .from("roster_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league.id)
      .eq("status", "submitted"),
    supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league.id)
      .eq("status", "submitted"),
    supabase
      .from("league_player_catalog")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league.id)
      .is("current_rating", null),
  ]);
  if (counts.some((result) => result.error))
    throw new Error("Unable to load registration tasks.");
  const behind = (
    await Promise.all(
      (seasons ?? [])
        .filter((season) => season.status === "published")
        .map((season) => seasonPayments(supabase, league.id, season.id)),
    )
  )
    .flat()
    .filter((team) => team.status.behind).length;
  const unscheduled = (await scheduleOverview(supabase, league.id)).filter(
    (division) => division.teamCount >= 2 && division.gameCount === 0,
  ).length;
  const isDemo = Boolean(
    settings &&
    typeof settings === "object" &&
    !Array.isArray(settings) &&
    settings.is_demo === true,
  );
  return (
    <Dashboard
      league={league}
      displayName={profile.display_name.trim()}
      role={roleTranslations(role)}
      platformAdmin={platformAdmin}
      members={[...members.values()]}
      isDemo={isDemo}
      seasons={seasons ?? []}
      canManage={platformAdmin || role === "commissioner"}
      tasks={{
        registrations: counts[0].count ?? 0,
        changes: counts[1].count ?? 0,
        unrated: counts[3].count ?? 0,
        toApprove: counts[2].count ?? 0,
        behind,
        unscheduled,
      }}
    />
  );
}
