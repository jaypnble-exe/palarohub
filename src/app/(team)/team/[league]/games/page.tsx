import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { managerOverview } from "@/lib/team-data";
import { AccessDenied } from "@/components/access-denied";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { GameList } from "@/components/schedule/game-list";

/** All games of the manager's approved teams: what is next, then results. */
export default async function TeamGamesPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, user, league, canRegister } = await getLeagueAccess(
    slug,
    "team",
  );
  if (!canRegister) return <AccessDenied />;
  const { games } = await managerOverview(supabase, league.id, user.id);
  const t = await getTranslations("TeamHome");
  const upcoming = games.filter(
    (game) => !["approved", "submitted"].includes(game.status),
  );
  const played = games
    .filter((game) => ["approved", "submitted"].includes(game.status))
    .reverse();
  return (
    <main className="space-y-6 py-6">
      <PageHeader eyebrow={league.name} title={t("gamesTitle")} />
      {!games.length ? (
        <EmptyState
          icon="schedule"
          title={t("noGames")}
          description={t("noGamesHelp")}
        />
      ) : (
        <>
          <Section id="upcoming" title={t("nextGames")}>
            {upcoming.length ? (
              <GameList games={upcoming} />
            ) : (
              <EmptyState icon="schedule" title={t("noUpcoming")} />
            )}
          </Section>
          {played.length > 0 && (
            <Section id="results" title={t("latestResults")}>
              <GameList games={played} />
            </Section>
          )}
        </>
      )}
    </main>
  );
}
