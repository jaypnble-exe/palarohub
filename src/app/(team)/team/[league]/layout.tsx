import { getLeagueAccess } from "@/lib/league-access";
import { TeamNav } from "@/components/team/team-nav";

/** Every team manager page shares the same navigation. */
export default async function TeamLeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { canRegister } = await getLeagueAccess(slug, "team");
  if (!canRegister) return children;
  return (
    <div className="pb-24 sm:pb-10">
      <TeamNav slug={slug} />
      {children}
    </div>
  );
}
