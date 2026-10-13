import { getLeagueAccess } from "@/lib/league-access";
import { managerOverview } from "@/lib/team-data";
import { AccessDenied } from "@/components/access-denied";
import { TeamHome } from "@/components/team/team-home";

export default async function TeamWorkspace({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, user, league, canRegister, canView } =
    await getLeagueAccess(slug, "team");
  if (!canRegister) return <AccessDenied />;
  const overview = await managerOverview(supabase, league.id, user.id);
  return (
    <TeamHome
      slug={slug}
      leagueName={league.name}
      overview={overview}
      canView={canView}
    />
  );
}
