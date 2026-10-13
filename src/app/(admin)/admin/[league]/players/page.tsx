import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { NameForm } from "@/components/registration/name-form";
import { EmptyState } from "@/components/ui/empty-state";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
export default async function PlayersPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const t = await getTranslations("Registration");
  const { data: players, error } = await supabase
    .from("league_player_catalog")
    .select("id,display_name,current_rating")
    .eq("league_id", league.id)
    .order("display_name");
  if (error) throw new Error("Unable to load players.");
  return (
    <main className="space-y-6 py-6">
      <PageHeader title={t("players")} />
      <details className={cardVariants()}>
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">
          {t("addNewPlayer")}
        </summary>
        <NameForm slug={slug} kind="player" />
      </details>
      {!players?.length ? (
        <EmptyState title={t("noPlayers")} />
      ) : (
        <ul className="space-y-3">
          {players.map((player) => (
            <li
              key={player.id}
              className={cn(
                cardVariants(),
                "flex flex-wrap items-center justify-between gap-3",
              )}
            >
              <div>
                <h2 className="font-semibold">{player.display_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {player.current_rating
                    ? t("playerRating", { rating: player.current_rating })
                    : t("unrated")}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/admin/${slug}/players/${player.id}`}>
                  {t("viewPlayer")}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
