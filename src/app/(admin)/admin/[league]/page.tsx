import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser, isPlatformAdmin, getSiteUrl } from "@/lib/auth";
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
  const currentSeason =
    (seasons ?? []).find((season) => season.status === "published") ?? null;
  const published = (seasons ?? []).filter(
    (season) => season.status === "published",
  );
  const paymentsBySeason = await Promise.all(
    published.map((season) => seasonPayments(supabase, league.id, season.id)),
  );
  const behind = paymentsBySeason
    .flat()
    .filter((team) => team.status.behind).length;
  const divisions = await scheduleOverview(supabase, league.id);
  const unscheduled = divisions.filter(
    (division) => division.teamCount >= 2 && division.gameCount === 0,
  ).length;
  // Games being played now, the next few on the schedule, and season totals.
  const gameFields =
    "id,division_id,home_team_name,away_team_name,venue,division_name,scheduled_at";
  const [live, upcoming, seasonGames, registration, registered] =
    await Promise.all([
      supabase
        .from("published_games")
        .select(gameFields)
        .eq("league_id", league.id)
        .eq("status", "in_progress")
        .order("scheduled_at"),
      supabase
        .from("published_games")
        .select(gameFields)
        .eq("league_id", league.id)
        .eq("status", "scheduled")
        .gte(
          "scheduled_at",
          new Date(new Date().getTime() - 3 * 3_600_000).toISOString(),
        )
        .order("scheduled_at")
        .limit(3),
      currentSeason
        ? supabase
            .from("published_games")
            .select("status")
            .eq("league_id", league.id)
            .eq("season_id", currentSeason.id)
            .neq("status", "cancelled")
        : { data: [] as { status: string | null }[], error: null },
      currentSeason
        ? supabase
            .from("registration_settings")
            .select("season_id,is_open,deadline")
            .eq("league_id", league.id)
            .eq("season_id", currentSeason.id)
            .maybeSingle()
        : { data: null, error: null },
      // Teams that have sent their registration this season (waiting or approved).
      currentSeason
        ? supabase
            .from("season_teams")
            .select("id", { count: "exact", head: true })
            .eq("league_id", league.id)
            .eq("season_id", currentSeason.id)
            .in("status", ["submitted", "approved"])
        : { count: 0, error: null },
    ]);
  if (
    live.error ||
    upcoming.error ||
    seasonGames.error ||
    registration.error ||
    registered.error
  )
    throw new Error("Unable to load games.");
  const toGame = (game: (typeof live.data)[number]) => ({
    id: game.id ?? "",
    divisionId: game.division_id ?? "",
    home: game.home_team_name ?? "",
    away: game.away_team_name ?? "",
    venue: game.venue ?? "",
    division: game.division_name ?? "",
    scheduledAt: game.scheduled_at,
  });
  const seasonTeams = currentSeason
    ? (paymentsBySeason[published.indexOf(currentSeason)] ?? [])
    : [];
  const season = currentSeason
    ? {
        name: currentSeason.name,
        teams: seasonTeams.length,
        gamesPlayed: seasonGames.data.filter(
          (game) => game.status === "approved",
        ).length,
        gamesTotal: seasonGames.data.length,
        collectedHalalas: seasonTeams.reduce(
          (sum, team) => sum + team.paidHalalas,
          0,
        ),
        expectedHalalas: seasonTeams.reduce(
          (sum, team) => sum + team.quotaHalalas + team.finesHalalas,
          0,
        ),
      }
    : null;
  // Setup steps for a new league, shown until the first schedule exists.
  const setup = {
    seasonId: currentSeason?.id ?? null,
    hasSeason: Boolean(currentSeason),
    registrationReady: Boolean(registration.data),
    teamsApproved: seasonTeams.length >= 2,
    scheduled: divisions.some((division) => division.gameCount > 0),
  };
  // While teams can register, the share link sits on the home screen.
  const registrationOpen =
    currentSeason &&
    registration.data?.is_open &&
    new Date(registration.data.deadline).getTime() > new Date().getTime()
      ? {
          url: `${getSiteUrl()}/${slug}/register/${currentSeason.id}`,
          settingsHref: `/admin/${slug}/seasons/${currentSeason.id}/registration`,
          deadline: registration.data.deadline,
          seasonName: currentSeason.name,
          registered: registered.count ?? 0,
        }
      : null;
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
      members={[...members.values()]}
      isDemo={isDemo}
      season={season}
      setup={setup}
      registration={registrationOpen}
      liveGames={live.data.map(toGame)}
      upcomingGames={upcoming.data.map(toGame)}
      tasks={{
        gamesToApprove: counts[2].count ?? 0,
        registrations: counts[0].count ?? 0,
        changes: counts[1].count ?? 0,
        teamsBehind: behind,
        unscheduled,
        unrated: counts[3].count ?? 0,
      }}
    />
  );
}
