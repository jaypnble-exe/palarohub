import { notFound } from "next/navigation";
import { z } from "zod";
import { getFormatter, getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { loadGameRecord } from "@/lib/game-record";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { BoxScores } from "@/components/scorer/basketball/box-score";
import { ReviewActions } from "@/components/review/review-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";

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
  const scorer = await getTranslations("Scorer");
  const format = await getFormatter();
  const { game, summary, teamNames, state } = record;
  const ejected = (summary?.ejectedPlayers ?? []).map((player) => ({
    playerId: player.playerId,
    label: `#${player.jersey} ${player.name} (${teamNames[player.team]})`,
  }));
  return (
    <main className="mx-auto max-w-3xl space-y-6 py-6">
      <PageHeader
        back={{ href: `/admin/${slug}/games`, label: t("backToGames") }}
        eyebrow={
          <>
            {record.seasonName} · {record.divisionName}
            {game.scheduledAt &&
              ` · ${format.dateTime(new Date(game.scheduledAt), { dateStyle: "medium", timeStyle: "short" })}`}
          </>
        }
        title={schedule("matchup", teamNames)}
        actions={
          game.status !== "cancelled" && (
            <Button asChild variant="outline">
              <a
                href={`/tv/${game.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="live" className="size-4" />
                {scorer("openTv")}
              </a>
            </Button>
          )
        }
      />

      {summary ? (
        <p className="font-display text-5xl font-semibold">
          {summary.homeScore} – {summary.awayScore}
        </p>
      ) : (
        <EmptyState title={t("notFinished")} />
      )}
      {record.unreadableEvents > 0 && (
        <Alert tone="warning">
          {t("unreadableEvents", { count: record.unreadableEvents })}
        </Alert>
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
