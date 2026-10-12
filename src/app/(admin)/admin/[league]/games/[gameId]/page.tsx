import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getFormatter, getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { loadGameRecord } from "@/lib/game-record";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { BoxScores } from "@/components/scorer/basketball/box-score";
import { ReviewActions } from "@/components/review/review-actions";

export default async function GameReviewPage({
  params,
}: {
  params: Promise<{ league: string; gameId: string }>;
}) {
  const { league: slug, gameId } = await params;
  if (!z.uuid().safeParse(gameId).success) notFound();
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const record = await loadGameRecord(supabase, gameId);
  if (!record || record.game.leagueId !== league.id) notFound();
  const t = await getTranslations("Review");
  const schedule = await getTranslations("Schedule");
  const format = await getFormatter();
  const { game, summary, teamNames, state } = record;
  const ejected = (summary?.ejectedPlayers ?? []).map((player) => ({
    playerId: player.playerId,
    label: `#${player.jersey} ${player.name} (${teamNames[player.team]})`,
  }));
  return (
    <main className="mx-auto max-w-3xl space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/admin/${slug}/games`}>{t("backToGames")}</Link>
      </Button>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {record.seasonName} · {record.divisionName}
          {game.scheduledAt &&
            ` · ${format.dateTime(new Date(game.scheduledAt), { dateStyle: "medium", timeStyle: "short" })}`}
        </p>
        <h1 className="font-display text-3xl font-semibold">
          {schedule("matchup", teamNames)}
        </h1>
        <span className="inline-block rounded-full bg-accent px-3 py-1 text-sm font-semibold">
          {schedule(`status.${game.status}`)}
        </span>
      </div>

      {summary ? (
        <p className="font-display text-5xl font-semibold">
          {summary.homeScore} – {summary.awayScore}
        </p>
      ) : (
        <p className="rounded-2xl border bg-card p-5">{t("notFinished")}</p>
      )}
      {record.unreadableEvents > 0 && (
        <p
          role="alert"
          className="rounded-xl bg-orange-soft p-4 text-sm text-orange-dark"
        >
          {t("unreadableEvents", { count: record.unreadableEvents })}
        </p>
      )}

      {game.status === "approved" && (
        <Button asChild>
          <a
            href={`/api/games/${game.id}/scoresheet`}
            target="_blank"
            rel="noopener"
          >
            {t("downloadScoresheet")}
          </a>
        </Button>
      )}

      {game.status === "submitted" && (
        <ReviewActions
          slug={slug}
          gameId={game.id}
          ejected={ejected}
          canApprove={Boolean(summary)}
        />
      )}

      {record.events.length > 0 && (
        <BoxScores state={state} teamNames={teamNames} />
      )}

      {record.reviews.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">{t("history")}</h2>
          <ol className="space-y-2">
            {record.reviews.map((review, index) => (
              <li key={index} className="rounded-xl border bg-card p-3 text-sm">
                <span className="font-semibold">
                  {t(`action.${review.action}`)}
                </span>
                {" · "}
                {format.dateTime(new Date(review.created_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {review.comment && (
                  <span className="block text-muted-foreground">
                    {review.comment}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
