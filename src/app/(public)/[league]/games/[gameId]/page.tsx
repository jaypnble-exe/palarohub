import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getFormatter, getTranslations } from "next-intl/server";
import { competitionContext, careerGames } from "@/lib/competition-data";
import { loadPlayerAwards } from "@/lib/player-awards";
import { PageHeader } from "@/components/ui/page-header";
import {
  PlayerOfGameCard,
  PlayerOfGameStats,
} from "@/components/public/player-of-game";

export default async function PublicGameResult({
  params,
}: {
  params: Promise<{ league: string; gameId: string }>;
}) {
  const { league: slug, gameId } = await params;
  if (!z.uuid().safeParse(gameId).success) notFound();
  const { supabase, league } = await competitionContext(slug);
  const { data: game, error } = await supabase
    .from("published_games")
    .select(
      "id,season_id,division_name,home_team_name,away_team_name,home_score,away_score,scheduled_at",
    )
    .eq("league_id", league.id)
    .eq("id", gameId)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw new Error("Unable to load approved game.");
  if (!game?.season_id) notFound();
  const awards = await loadPlayerAwards(supabase, league.id, { gameId });
  const { games } = await careerGames(supabase, league.id, game.season_id);
  const players = games.filter((player) => player.gameId === gameId);
  const t = await getTranslations("PlayerOfGame");
  const format = await getFormatter();
  return (
    <main className="mx-auto max-w-3xl space-y-6 py-6">
      <PageHeader
        back={{ href: `/${slug}/schedule`, label: t("backToSchedule") }}
        eyebrow={game.division_name ?? league.name}
        title={t("resultTitle", {
          home: game.home_team_name ?? "",
          away: game.away_team_name ?? "",
        })}
      />
      <p className="font-display text-5xl font-semibold tabular-nums">
        {game.home_score} – {game.away_score}
      </p>
      {game.scheduled_at && (
        <p className="text-sm text-muted-foreground">
          {format.dateTime(new Date(game.scheduled_at), {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
      {awards[0] ? (
        <PlayerOfGameCard slug={slug} award={awards[0]} />
      ) : (
        <p className="text-muted-foreground">{t("noConfirmed")}</p>
      )}
      {players.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">
            {t("gameStats")}
          </h2>
          {players.map((player) => (
            <article
              key={player.playerId}
              className="space-y-3 rounded-2xl border bg-card p-4"
            >
              <Link
                href={`/${slug}/players/${player.playerId}`}
                className="font-semibold text-orange-dark hover:underline"
              >
                {player.name}
              </Link>
              <p className="text-sm text-muted-foreground">{player.teamName}</p>
              <PlayerOfGameStats metrics={player.metrics} />
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
