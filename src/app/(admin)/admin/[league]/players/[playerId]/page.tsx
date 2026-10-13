import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations, getFormatter } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import {
  PlayerRatingForm,
  PlayerChecksForm,
} from "@/components/registration/player-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ league: string; playerId: string }>;
}) {
  const { league: slug, playerId } = await params;
  if (!z.uuid().safeParse(playerId).success) notFound();
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const [player, ratings, checks, scale, seasons] = await Promise.all([
    supabase
      .from("players")
      .select("id,display_name")
      .eq("league_id", league.id)
      .eq("id", playerId)
      .maybeSingle(),
    supabase
      .from("player_ratings")
      .select("id,rating,effective_from,reason,profiles(display_name)")
      .eq("league_id", league.id)
      .eq("player_id", playerId)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("player_checks")
      .select("documents_present,suspended")
      .eq("league_id", league.id)
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("league_rating_scales")
      .select("labels")
      .eq("league_id", league.id)
      .single(),
    supabase.from("seasons").select("rating_scale").eq("league_id", league.id),
  ]);
  if ([player, ratings, checks, scale, seasons].some((result) => result.error))
    throw new Error("Unable to load player details.");
  if (!player.data) notFound();
  const t = await getTranslations("Registration");
  const format = await getFormatter();
  const labels = [
    ...new Set([
      ...(scale.data?.labels ?? []),
      ...(seasons.data?.flatMap((season) => season.rating_scale) ?? []),
    ]),
  ];
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{ href: `/admin/${slug}/players`, label: t("backPlayers") }}
        title={player.data.display_name}
      />
      {canManage && (
        <PlayerRatingForm
          slug={slug}
          playerId={playerId}
          labels={labels}
          defaultTime={new Date().toISOString()}
        />
      )}
      <PlayerChecksForm
        slug={slug}
        canSuspend={canManage}
        initial={{
          playerId,
          documentsPresent: checks.data?.documents_present ?? false,
          suspended: checks.data?.suspended ?? false,
        }}
      />
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          {t("ratingHistory")}
        </h2>
        {!ratings.data?.length ? (
          <EmptyState title={t("unratedHelp")} />
        ) : (
          <ol className="space-y-3">
            {ratings.data.map((rating) => (
              <li
                key={rating.id}
                className="space-y-2 rounded-xl border bg-card p-4"
              >
                <p className="font-semibold">
                  {t("playerRating", { rating: rating.rating })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("ratingEffectiveValue", {
                    date: format.dateTime(new Date(rating.effective_from), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })}
                </p>
                <p className="text-sm">{rating.reason}</p>
                <p className="text-sm text-muted-foreground">
                  {t("setBy", {
                    name: rating.profiles?.display_name || t("leagueOfficial"),
                  })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
