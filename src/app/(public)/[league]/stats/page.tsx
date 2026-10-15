import { getTranslations } from "next-intl/server";
import { competitionContext, careerGames } from "@/lib/competition-data";
import { aggregateCareer } from "@/lib/domain/career-stats";
import { CompetitionHeader } from "@/components/public/competition-header";
import { CareerTable } from "@/components/public/career-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ season?: string; q?: string }>;
}) {
  const { league: slug } = await params;
  const query = await searchParams;
  const { supabase, league, seasons } = await competitionContext(slug);
  const season = seasons.find((item) => item.id === query.season) ?? seasons[0];
  const t = await getTranslations("Competition");
  const data = season
    ? await careerGames(supabase, league.id, season.id)
    : { games: [], unreadableGames: 0 };
  const search = (query.q ?? "").trim().slice(0, 100);
  return (
    <main className="space-y-6 py-6">
      <CompetitionHeader
        slug={slug}
        leagueName={league.name}
        section="stats"
        seasons={seasons}
        season={season}
      />
      {data.unreadableGames > 0 && (
        <Alert tone="warning">{t("incompleteStats")}</Alert>
      )}
      {season && (
        <form className="flex gap-2">
          <input type="hidden" name="season" value={season.id} />
          <Input
            name="q"
            defaultValue={search}
            aria-label={t("searchPlayers")}
            placeholder={t("searchPlayers")}
            maxLength={100}
          />
          <Button type="submit">{t("search")}</Button>
        </form>
      )}
      {season ? (
        season.divisions.map((division) => {
          const rows = aggregateCareer(
            data.games.filter((game) => game.divisionId === division.id),
          ).filter((row) =>
            row.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
          );
          return (
            <section key={division.id} className="space-y-3">
              <h2 className="font-display text-2xl font-semibold">
                {division.name}
              </h2>
              <p className="text-sm text-muted-foreground">{t("averages")}</p>
              {rows.length ? (
                <CareerTable
                  rows={rows}
                  sport={division.sport}
                  slug={slug}
                  label={division.name}
                />
              ) : (
                <EmptyState title={t(search ? "noPlayersMatch" : "noStats")} />
              )}
            </section>
          );
        })
      ) : (
        <EmptyState title={t("noSeason")} />
      )}
    </main>
  );
}
