import { competitionContext, bracketData } from "@/lib/competition-data";
import { CompetitionHeader } from "@/components/public/competition-header";
import { BracketBoard } from "@/components/public/bracket-board";

export default async function BracketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { league: slug } = await params;
  const query = await searchParams;
  const { supabase, league, seasons } = await competitionContext(slug);
  const season = seasons.find((s) => s.id === query.season) ?? seasons[0];
  const data = season
    ? await bracketData(supabase, league.id, season.id)
    : { brackets: [], slots: [], games: [], teams: [] };
  return (
    <main className="min-w-0 space-y-6 py-6">
      <CompetitionHeader
        slug={slug}
        leagueName={league.name}
        section="brackets"
        season={season}
        seasons={seasons}
      />
      <BracketBoard
        data={data}
        divisions={season?.divisions ?? []}
        slug={slug}
      />
    </main>
  );
}
